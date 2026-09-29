"""Create the original cast's voice plan and small English listening games."""
from pathlib import Path
import json
root=Path(__file__).resolve().parent.parent
path=root/'scripts/audio-lines.json'
lines=json.loads(path.read_text(encoding='utf-8'))
cast={
 'foxy':('fox','af_bella',3.0), 'cat':('cat','af_heart',3.2),
 'dog':('dog','am_fenrir',4.2), 'lion':('lion','am_michael',2.3),
 'bunny':('rabbit','af_sky',3.8), 'bear':('bear','am_adam',1.8),
 'panda':('panda','af_nicole',2.5), 'elephant':('elephant','af_sarah',2.0),
}
sounds={'foxy':'Yip, yip!', 'cat':'Meow, meow!', 'dog':'Woof, woof!', 'lion':'Roar! A tiny roar!',
        'bunny':'Hop, hop!', 'bear':'A little growl!', 'panda':'A little panda sound!', 'elephant':'Toot, toot!'}
for id,(word,voice,pitch) in cast.items():
    article='an' if word=='elephant' else 'a'
    if word not in lines: lines[word]={'text':word.capitalize()+'!','group':'words','speed':.95}
    lines[word].update(voice=voice,pitch=pitch)
    if 'a-'+word in lines: lines['a-'+word].update(voice=voice,pitch=pitch)
    phrases={'idle':f'Hello! I am {article} {word}!', 'happy':"Happy! I'm happy!",
             'wave':'Wave! Hello, friend!', 'jump':'Jump! Jump with me!', 'run':'Run! I can run!',
             'sleep':'Sleep. Good night, little friend.', 'roar':sounds[id]}
    for action,text in phrases.items():
        lines[f'character-{id}-{action}']={'text':text,'group':'characters','speed':.93 if action=='sleep' else 1.01,
                                         'voice':voice,'pitch':pitch if action!='sleep' else pitch-.6}
    lines['find-'+word]={'text':f'Can you find the {word}?','group':'foxy','speed':.98,'voice':'af_bella','pitch':3.0}
    lines['well-done-'+word]={'text':f'Yes! A {word}!' if article=='a' else f'Yes! An {word}!',
                            'group':'foxy','speed':1.0,'voice':'af_bella','pitch':3.0}
for action,text in {'wave':'Can you wave? Wave!','jump':'Can you jump? Jump!',
                    'run':'Can you run? Run!','sleep':'Time to sleep. Sleep!',
                    'happy':'Show me happy! Happy!'}.items():
    lines['ask-'+action]={'text':text,'group':'foxy','speed':.98,'voice':'af_bella','pitch':3.0}
lines['try-again']={'text':"Let's listen again! You can do it!",'group':'foxy','speed':.98,'voice':'af_bella','pitch':3.0}
path.write_text(json.dumps(lines,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(f'Voice plan: {len(lines)} spoken clips across {len(cast)} distinct voices')
