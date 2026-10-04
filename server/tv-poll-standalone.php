<?php
declare(strict_types=1);
/** Same-origin TV relay. State and lock live outside the public web root. */
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); echo '{}'; exit; }
$raw = file_get_contents('php://input', false, null, 0, 16385);
if ($raw === false || strlen($raw) > 16384) { http_response_code(413); echo '{}'; exit; }
try { $input = json_decode($raw, true, 16, JSON_THROW_ON_ERROR); }
catch (Throwable $error) { http_response_code(400); echo '{}'; exit; }
if (!is_array($input) || !isset($input['messages']) || !is_array($input['messages']) || count($input['messages']) > 12) {
    http_response_code(400); echo '{}'; exit;
}
foreach ($input['messages'] as $message) {
    if (!is_string($message) || strlen($message) > 8192) { http_response_code(400); echo '{}'; exit; }
}

function randomId(int $bytes): string { return rtrim(strtr(base64_encode(random_bytes($bytes)), '+/', '-_'), '='); }
function sendTo(array &$db, ?string $sid, array $message): void {
    if ($sid === null || !isset($db['sessions'][$sid])) return;
    $queue = &$db['sessions'][$sid]['queue'];
    $queue[] = ['v'=>1] + $message;
    if (count($queue) > 80) $queue = array_slice($queue, -80);
}
function both(array &$db, string $code, array $message): void {
    if (!isset($db['rooms'][$code])) return;
    sendTo($db, $db['rooms'][$code]['tv'], $message);
    sendTo($db, $db['rooms'][$code]['controller'], $message);
}
function presence(array &$db, string $code): void {
    if (!isset($db['rooms'][$code])) return;
    $r = $db['rooms'][$code];
    both($db,$code,['kind'=>'presence','tvReady'=>$r['tvReady'] && $r['tv'] !== null,
        'controllerPresent'=>$r['controller'] !== null,'tvSoundReady'=>$r['audioReady'],
        'audioTarget'=>$r['audioTarget']]);
}
function snapshot(array &$db, string $code): void {
    if (!isset($db['rooms'][$code]) || $db['rooms'][$code]['snapshot'] === null) return;
    $view = $db['rooms'][$code]['snapshot'];
    $view['sequence'] = ++$db['rooms'][$code]['sequence'];
    $view['released'] = array_keys($db['rooms'][$code]['released']);
    both($db,$code,['kind'=>'snapshot','snapshot'=>$view]);
}
function cancelTransfer(array &$db, string $code, string $tid): void {
    if (!isset($db['rooms'][$code]['transfers'][$tid])) return;
    unset($db['rooms'][$code]['transfers'][$tid]);
    both($db,$code,['kind'=>'transfer-cancelled','transferId'=>$tid]);
}
function clearTransfers(array &$db, string $code): void {
    foreach (array_keys($db['rooms'][$code]['transfers'] ?? []) as $tid) cancelTransfer($db,$code,$tid);
}
function detach(array &$db, string $sid): void {
    $peer=$db['sessions'][$sid] ?? null;
    if (!$peer) return;
    $code=$peer['code']; $role=$peer['role']; unset($db['sessions'][$sid]);
    if ($code === null || !isset($db['rooms'][$code]) || $db['rooms'][$code][$role] !== $sid) return;
    $db['rooms'][$code][$role]=null;
    if ($role === 'tv') { $db['rooms'][$code]['tvReady']=false; $db['rooms'][$code]['audioReady']=false; }
    clearTransfers($db,$code); presence($db,$code);
}
function cleanup(array &$db, float $now): void {
    foreach ($db['sessions'] as $sid=>$peer) if ($now-$peer['touched'] > 65) detach($db,$sid);
    foreach (array_keys($db['rooms']) as $code) {
        $code=(string)$code;
        if ($now-$db['rooms'][$code]['touched'] > 7200) {
            foreach ([$db['rooms'][$code]['tv'],$db['rooms'][$code]['controller']] as $sid)
                if ($sid !== null) unset($db['sessions'][$sid]);
            unset($db['rooms'][$code]); continue;
        }
        foreach ($db['rooms'][$code]['transfers'] as $tid=>$transfer) {
            if (!$transfer['committed'] && $now >= $transfer['expires']) {
                cancelTransfer($db,$code,$tid); continue;
            }
            if ($transfer['committed'] && $now >= $transfer['revealAt']) {
                if (!$db['rooms'][$code]['tvReady'] || !$db['rooms'][$code]['tv'] || !$db['rooms'][$code]['controller']) {
                    cancelTransfer($db,$code,$tid); continue;
                }
                $db['rooms'][$code]['released'][$transfer['id']]=true;
                unset($db['rooms'][$code]['transfers'][$tid]); snapshot($db,$code);
            }
        }
    }
    foreach ($db['attempts'] as $ip=>$times) {
        $recent=array_values(array_filter($times,fn($time)=>$now-$time<60));
        if ($recent) $db['attempts'][$ip]=$recent; else unset($db['attempts'][$ip]);
    }
}
function allow(array &$db, string $ip, float $now): bool {
    $recent=array_values(array_filter($db['attempts'][$ip] ?? [],fn($time)=>$now-$time<60));
    if (count($recent)>=10) return false;
    $recent[]=$now; $db['attempts'][$ip]=$recent; return true;
}
function joined(array &$db, string $sid, string $code, string $role): void {
    $old=$db['rooms'][$code][$role];
    if ($old !== null && $old !== $sid) detach($db,$old);
    $db['rooms'][$code][$role]=$sid; $db['rooms'][$code]['touched']=microtime(true);
    $db['sessions'][$sid]['role']=$role; $db['sessions'][$sid]['code']=$code;
    sendTo($db,$sid,['kind'=>'joined','role'=>$role,'code'=>$code,
        'token'=>$db['rooms'][$code][$role.'Token'],'serverTime'=>round(microtime(true)*1000)]);
    presence($db,$code); snapshot($db,$code);
    if ($role === 'tv' && $db['rooms'][$code]['friendScene'] !== null)
        sendTo($db,$sid,['kind'=>'event','event'=>'FRIEND_SCENE',
            'payload'=>$db['rooms'][$code]['friendScene'],
            'sequence'=>++$db['rooms'][$code]['sequence']]);
    if ($role === 'tv' && ($db['rooms'][$code]['singScene'] ?? null) !== null)
        sendTo($db,$sid,['kind'=>'event','event'=>'SING_SCENE','payload'=>$db['rooms'][$code]['singScene'],'sequence'=>++$db['rooms'][$code]['sequence']]);
}
function validEvent(string $event, $payload): ?array {
    if (!is_array($payload)) $payload=[];
    if ($event === 'SING_SCENE') {
        $p=$payload;
        $limits=json_decode(file_get_contents(__DIR__.'/music/song-limits.json') ?: '{}',true);
        $limit=is_string($p['song'] ?? null) ? ($limits[$p['song']] ?? null) : null;
        if (!$limit || !in_array($p['mode'] ?? null,['together','echo','concert'],true) ||
            (!is_int($p['time'] ?? null) && !is_float($p['time'] ?? null)) || !is_finite((float)$p['time']) || $p['time']<0 || $p['time']>(($p['mode']==='echo')?$limit['echo']:(($p['mode']==='concert')?($limit['concert'] ?? $limit['duration']):$limit['duration']))+0.001 ||
            !is_bool($p['playing'] ?? null) || !is_bool($p['guide'] ?? null) || !is_bool($p['active'] ?? null) ||
            (!is_int($p['sentAt'] ?? null) && !is_float($p['sentAt'] ?? null)) || !is_finite((float)$p['sentAt']) ||
            !is_array($p['stars'] ?? null) || count($p['stars'])>$limit['lines']) return null;
        foreach ($p['stars'] as $star) if (!is_int($star) || $star<0 || $star>=$limit['lines']) return null;
        return ['song'=>$p['song'],'mode'=>$p['mode'],'time'=>$p['time'],'playing'=>$p['playing'],'guide'=>$p['guide'],'active'=>$p['active'],'sentAt'=>$p['sentAt'],'stars'=>array_values(array_unique($p['stars']))];
    }
    $animals=['cat','dog','lion','foxy','bunny','bear','panda','elephant'];
    $friends=['foxy','cat','dog','lion','bunny','bear','panda','elephant'];
    $moods=['idle','lookAround','point','happy','surprised','scared','laugh','dance','fall'];
    $actions=array_merge($moods,['jump','play','spin','chase tail','run','sit','sleep','roll','wave','roar','woof','meow','sing','tired','hungry','thirsty','sad']);
    $worlds=['meadow','space','forest','trampoline'];
    $states=['BOOT','WELCOME','CAMERA_PERMISSION','INTRO','FINALE','COMPLETE','FREE_PLAY'];
    foreach ($animals as $animal) { $upper=strtoupper($animal); array_push($states,'FIND_'.$upper,$upper.'_FOUND',$upper.'_PLAY'); }
    $cues=['rabbit','bear','panda','elephant','hello','intro','great','friends','cat','dog','lion',
        'a-cat','a-dog','a-lion','find-cat','find-dog','find-lion','meow','woof','roar'];
    $manifest=json_decode(file_get_contents(__DIR__.'/audio/manifest.json') ?: '{}',true);
    foreach ($manifest['clips'] ?? [] as $clip) { if (isset($clip['cue']) && is_string($clip['cue'])) $cues[]=$clip['cue']; }
    if ($event === 'FRIEND_SCENE') {
        $animal=$payload['id'] ?? null;
        return ($animal === null || in_array($animal,$friends,true)) && in_array($payload['action'] ?? null,$actions,true) &&
            (!isset($payload['world']) || in_array($payload['world'],$worlds,true)) &&
            (!isset($payload['caption']) || is_string($payload['caption']) && strlen($payload['caption'])<=120)
            ? array_merge(['id'=>$animal,'action'=>$payload['action']],isset($payload['world']) ? ['world'=>$payload['world']] : [],isset($payload['caption']) ? ['caption'=>$payload['caption']] : []) : null;
    }
    if ($event === 'AUDIO_ROUTE') return in_array($payload['target'] ?? null,['ipad','tv'],true) ? ['target'=>$payload['target']] : null;
    if ($event === 'AUDIO_CUE') return in_array($payload['cue'] ?? null,$cues,true) ? ['cue'=>$payload['cue']] : null;
    if ($event === 'ANIMAL_FOUND') return in_array($payload['id'] ?? null,$animals,true) ? ['id'=>$payload['id']] : null;
    if ($event === 'SCENE_CHANGE') return in_array($payload['state'] ?? null,$states,true) ? ['state'=>$payload['state']] : null;
    if (in_array($event,['GAME_STARTED','FINALE','CELEBRATION'],true)) return [];
    if ($event !== 'SCENE_SYNC') return null;
    $scene=$payload['scene'] ?? null;
    if (!in_array($payload['state'] ?? null,$states,true) || !is_array($scene) ||
        !is_string($scene['caption'] ?? null) || strlen($scene['caption'])>120 ||
        !(($scene['animal'] ?? null) === null || in_array($scene['animal'],$animals,true)) ||
        !is_numeric($scene['reveal'] ?? null) || !is_finite((float)$scene['reveal']) ||
        $scene['reveal']<0 || $scene['reveal']>1 ||
        !in_array($scene['action'] ?? null,$actions,true) || !in_array($scene['foxy'] ?? null,$moods,true) ||
        !is_bool($scene['effects'] ?? null) || !is_bool($scene['finale'] ?? null) ||
        (isset($scene['world']) && !in_array($scene['world'],$worlds,true)) ||
        (isset($payload['paused']) && !is_bool($payload['paused']))) return null;
    return ['state'=>$payload['state'],'paused'=>$payload['paused'] ?? false,
        'scene'=>['caption'=>$scene['caption'],'animal'=>$scene['animal'] ?? null,'reveal'=>(float)$scene['reveal'],
            'action'=>$scene['action'],'foxy'=>$scene['foxy'],'effects'=>$scene['effects'],'finale'=>$scene['finale']] +
            (isset($scene['world']) ? ['world'=>$scene['world']] : [])];
}
function errorTo(array &$db, string $sid, string $code, string $message): void {
    sendTo($db,$sid,['kind'=>'error','code'=>$code,'message'=>$message]);
}
function processMessage(array &$db, string $sid, array $message, float $now): void {
    if (($message['v'] ?? null)!==1 || !is_string($message['kind'] ?? null)) {
        errorTo($db,$sid,'BAD_MESSAGE','Unsupported protocol.'); return;
    }
    $kind=$message['kind'];
    if ($kind==='ping' && is_numeric($message['sentAt'] ?? null)) {
        sendTo($db,$sid,['kind'=>'pong','sentAt'=>$message['sentAt'],'serverTime'=>round($now*1000)]); return;
    }
    $peer=$db['sessions'][$sid] ?? null;
    if (!$peer) return;
    if ($peer['role']===null) {
        $ip=$peer['ip'];
        if ($kind==='create') {
            if (!allow($db,$ip,$now) || count($db['rooms'])>=200) {
                errorTo($db,$sid,'RATE_LIMIT','Please wait before creating another code.'); return;
            }
            do { $code=(string)random_int(100000,999999); } while (isset($db['rooms'][$code]));
            $db['rooms'][$code]=['tvToken'=>randomId(32),'controllerToken'=>null,'tv'=>null,'controller'=>null,
                'tvReady'=>false,'audioReady'=>false,'audioTarget'=>'ipad','snapshot'=>null,
                'friendScene'=>null,'singScene'=>null,'sequence'=>0,'released'=>[],'transfers'=>[],'touched'=>$now];
            joined($db,$sid,$code,'tv'); return;
        }
        if ($kind==='pair') {
            if (!allow($db,$ip,$now)) { errorTo($db,$sid,'RATE_LIMIT','Too many attempts. Wait one minute.'); return; }
            $code=$message['code'] ?? '';
            if (!is_string($code) || !isset($db['rooms'][$code]) || $db['rooms'][$code]['tv']===null) {
                errorTo($db,$sid,'INVALID_CODE','Check the six-digit code on the TV.'); return;
            }
            if ($db['rooms'][$code]['controllerToken']!==null) {
                errorTo($db,$sid,'IN_USE','This TV is already paired. Choose New code on the TV.'); return;
            }
            $db['rooms'][$code]['controllerToken']=randomId(32);
            joined($db,$sid,$code,'controller'); return;
        }
        if ($kind==='resume') {
            $code=$message['code'] ?? ''; $role=$message['role'] ?? ''; $token=$message['token'] ?? '';
            if (!is_string($code) || !isset($db['rooms'][$code]) || !in_array($role,['tv','controller'],true) ||
                !is_string($token) || !is_string($db['rooms'][$code][$role.'Token'] ?? null) ||
                !hash_equals($db['rooms'][$code][$role.'Token'],$token)) {
                errorTo($db,$sid,'SESSION_ENDED','This session expired. Pair using a new TV code.'); return;
            }
            joined($db,$sid,$code,$role); return;
        }
        errorTo($db,$sid,'NOT_PAIRED','Pair before sending game events.'); return;
    }
    $code=$peer['code']; $role=$peer['role'];
    if (!isset($db['rooms'][$code]) || $db['rooms'][$code][$role]!==$sid) return;
    $db['rooms'][$code]['touched']=$now;
    if ($kind==='leave') {
        if ($role==='tv') {
            $other=$db['rooms'][$code]['controller'];
            errorTo($db,$sid,'SESSION_ENDED','The TV session ended.');
            if ($other!==null) errorTo($db,$other,'SESSION_ENDED','The TV session ended.');
            unset($db['rooms'][$code]);
            $db['sessions'][$sid]['role']=null; $db['sessions'][$sid]['code']=null;
            if ($other!==null && isset($db['sessions'][$other])) {
                $db['sessions'][$other]['role']=null; $db['sessions'][$other]['code']=null;
            }
        } else {
            clearTransfers($db,$code); $db['rooms'][$code]['controller']=null;
            $db['rooms'][$code]['controllerToken']=null;
            $db['sessions'][$sid]['role']=null; $db['sessions'][$sid]['code']=null;
            presence($db,$code);
        }
        return;
    }
    if ($role==='tv') {
        if ($kind==='sound-ready' && is_bool($message['ready'] ?? null)) {
            $db['rooms'][$code]['audioReady']=$message['ready']; presence($db,$code); return;
        }
        if ($kind==='ready' && is_bool($message['ready'] ?? null)) {
            $db['rooms'][$code]['tvReady']=$message['ready'];
            if (!$message['ready']) clearTransfers($db,$code);
            presence($db,$code); return;
        }
        if ($kind==='transfer-ready') {
            $tid=$message['transferId'] ?? '';
            if (!is_string($tid) || !isset($db['rooms'][$code]['transfers'][$tid]) ||
                !$db['rooms'][$code]['tvReady'] || $db['rooms'][$code]['controller']===null) return;
            $transfer=&$db['rooms'][$code]['transfers'][$tid];
            if ($transfer['committed']) return;
            $transfer['committed']=true; $transfer['revealAt']=$now+.9;
            both($db,$code,['kind'=>'transfer-commit','transfer'=>[
                'transferId'=>$tid,'id'=>$transfer['id'],'revealAt'=>round($transfer['revealAt']*1000)]]);
            unset($transfer); return;
        }
        errorTo($db,$sid,'READ_ONLY','The TV receives game events.'); return;
    }
    if ($kind==='event') {
        $event=$message['event'] ?? '';
        $payload=is_string($event) ? validEvent($event,$message['payload'] ?? null) : null;
        if ($payload===null) { errorTo($db,$sid,'BAD_EVENT','Unsupported game event.'); return; }
        if ($event==='AUDIO_ROUTE') { $db['rooms'][$code]['audioTarget']=$payload['target']; presence($db,$code); return; }
        if ($event==='AUDIO_CUE' && (!$db['rooms'][$code]['audioReady'] ||
            $db['rooms'][$code]['audioTarget']!=='tv' || !$db['rooms'][$code]['tvReady'])) return;
        if ($event==='GAME_STARTED' || ($event==='SCENE_CHANGE' && $payload['state']==='WELCOME')) {
            clearTransfers($db,$code); $db['rooms'][$code]['released']=[]; $db['rooms'][$code]['friendScene']=null; $db['rooms'][$code]['singScene']=null;
        }
        if ($event==='SCENE_SYNC') {
            $db['rooms'][$code]['snapshot']=$payload;
            if (!$payload['paused']) $db['rooms'][$code]['friendScene']=null;
            if (!$payload['paused']) $db['rooms'][$code]['singScene']=null;
            snapshot($db,$code);
        } else {
            if ($event==='FRIEND_SCENE') $db['rooms'][$code]['friendScene']=$payload;
            if ($event==='FRIEND_SCENE') $db['rooms'][$code]['singScene']=null;
            if ($event==='SING_SCENE') $db['rooms'][$code]['singScene']=$payload['active'] ? $payload : null;
            sendTo($db,$db['rooms'][$code]['tv'],['kind'=>'event','event'=>$event,'payload'=>$payload,
                'sequence'=>++$db['rooms'][$code]['sequence']]);
        }
        return;
    }
    if ($kind==='transfer-prepare') {
        $tid=$message['transferId'] ?? ''; $animal=$message['id'] ?? '';
        if (!$db['rooms'][$code]['tvReady'] || $db['rooms'][$code]['tv']===null) {
            sendTo($db,$sid,['kind'=>'transfer-cancelled','transferId'=>$tid]); return;
        }
        if (!is_string($animal) || !in_array($animal,['cat','dog','lion'],true) ||
            !is_string($tid) || !preg_match('/^[a-zA-Z0-9-]{8,64}$/',$tid)) {
            errorTo($db,$sid,'BAD_TRANSFER','Invalid transfer.'); return;
        }
        if (isset($db['rooms'][$code]['transfers'][$tid])) return;
        if (count($db['rooms'][$code]['transfers'])>=128) {
            sendTo($db,$sid,['kind'=>'transfer-cancelled','transferId'=>$tid]); return;
        }
        $db['rooms'][$code]['transfers'][$tid]=['id'=>$animal,'committed'=>false,'expires'=>$now+1.5,'revealAt'=>null];
        sendTo($db,$db['rooms'][$code]['tv'],['kind'=>'transfer-prepare',
            'transfer'=>['id'=>$animal,'transferId'=>$tid]]); return;
    }
    if ($kind==='transfer-cancel') {
        if (is_string($message['transferId'] ?? null)) cancelTransfer($db,$code,$message['transferId']);
        return;
    }
    errorTo($db,$sid,'BAD_MESSAGE','Unsupported command.');
}

$path=getenv('MAGIC_ANIMALS_TV_STATE_PATH') ?: dirname(__DIR__,2).'/apps/magic-animals/tmp/tv-state.json';
$file=@fopen($path,'c+');
if (!$file || !flock($file,LOCK_EX)) { http_response_code(503); echo '{}'; exit; }
try {
    rewind($file); $saved=stream_get_contents($file);
    $db=$saved ? json_decode($saved,true) : ['rooms'=>[],'sessions'=>[],'attempts'=>[]];
    if (!is_array($db) || !isset($db['rooms'],$db['sessions'],$db['attempts']))
        throw new RuntimeException('Invalid relay state');
    $now=microtime(true); cleanup($db,$now);
    $sid=$input['sessionId'] ?? null;
    if ($sid===null) {
        if (count($db['sessions'])>=400) { http_response_code(503); echo '{}'; exit; }
        $sid=randomId(24);
        $db['sessions'][$sid]=['role'=>null,'code'=>null,'ip'=>$_SERVER['REMOTE_ADDR'] ?? 'unknown',
            'queue'=>[],'touched'=>$now];
    } elseif (!is_string($sid) || !preg_match('/^[A-Za-z0-9_-]{32}$/',$sid) || !isset($db['sessions'][$sid])) {
        http_response_code(410); echo '{}'; exit;
    }
    $db['sessions'][$sid]['touched']=$now;
    foreach ($input['messages'] as $serialized) {
        try { $message=json_decode($serialized,true,16,JSON_THROW_ON_ERROR); }
        catch (Throwable $error) { errorTo($db,$sid,'BAD_MESSAGE','Invalid JSON.'); continue; }
        if (!is_array($message)) { errorTo($db,$sid,'BAD_MESSAGE','Invalid JSON.'); continue; }
        processMessage($db,$sid,$message,$now);
    }
    $out=$db['sessions'][$sid]['queue'] ?? [];
    if (isset($db['sessions'][$sid])) $db['sessions'][$sid]['queue']=[];
    $encoded=json_encode($db,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
    rewind($file); ftruncate($file,0); fwrite($file,$encoded); fflush($file);
    echo json_encode(['sessionId'=>$sid,'messages'=>array_map(
        fn($message)=>json_encode($message,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES),$out)],
        JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
} catch (Throwable $error) {
    error_log('Magic Animals TV relay: ' . $error->getMessage());
    http_response_code(500); echo '{}';
} finally { flock($file,LOCK_UN); fclose($file); }
