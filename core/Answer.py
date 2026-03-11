import subprocess #executa o terminal de dentro do script

class Answer:

    def __init__(self):

            #iniciate the default speak of mac
        self.voice_pt = "Luciana"
        self.voice_en = "Samantha"

    def falar(self,text, idioma = "en"): # receive always a text in english

        print(f"🤖 IA: {text}...")
        voz_escolhida = self.voice_en if idioma == "en" else self.voice_pt

        try:
            subprocess.run(["say", "-v", voz_escolhida, text]) #roda o terminal , vira comando
        except Exception as e:
            print(f"erro ao tentar falar : {e}")    #guarda o erro na variavel e






