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
learning={
 'happy':'I am happy!', 'wave':'I am waving!', 'jump':'I am jumping!',
 'run':'I am running!', 'sleep':'I am sleeping.', 'sing':'I am singing! La, la, la!',
 'tired':'I am tired.', 'hungry':'I am hungry.', 'thirsty':'I am thirsty.', 'sad':'I am sad.',
}
facts={
 'cat':'I have whiskers and soft paws. Whiskers! Paws!',
 'foxy':'I have a fluffy tail and pointed ears. Tail! Ears!',
 'dog':'I have floppy ears and little paws. Ears! Paws!',
 'lion':'I have a soft mane and big paws. Mane! Paws!',
 'bunny':'I have long ears. I can hop! Long ears! Hop!',
 'bear':'I have round ears and soft paws. Round ears! Paws!',
 'panda':'I am black and white. I have soft paws. Black! White!',
 'elephant':'I have big ears and a trunk. Big ears! Trunk!',
}
for id,(_,voice,pitch) in cast.items():
    for action,text in learning.items():
        lines[f'character-{id}-learn-{action}']={'text':text,'group':'characters','speed':.92,
            'voice':voice,'pitch':pitch-.6 if action in ['sleep','tired','sad'] else pitch}
    lines[f'character-{id}-discover']={'text':facts[id],'group':'characters','speed':.94,'voice':voice,'pitch':pitch}
for action,text in {'sing':'Can you find singing? Sing!', 'tired':'Who is tired? Tired!',
    'hungry':'Who is hungry? Hungry!', 'thirsty':'Who is thirsty? Thirsty!', 'sad':'Who is sad? Sad!'}.items():
    lines['ask-'+action]={'text':text,'group':'foxy','speed':.94,'voice':'af_bella','pitch':3.0}
for cue,text in {'hunt-start':"Let's find all eight friends! Show me a card!",
    'world-space':'Space! A rocket! Blast off!', 'world-meadow':'A meadow! Flowers and sunshine!',
    'world-forest':'A forest! So many trees!', 'world-trampoline':'Trampolines! Bounce, bounce!'}.items():
    lines[cue]={'text':text,'group':'foxy','speed':.94,'voice':'af_bella','pitch':3.0}
path.write_text(json.dumps(lines,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(f'Voice plan: {len(lines)} spoken clips across {len(cast)} distinct voices')
