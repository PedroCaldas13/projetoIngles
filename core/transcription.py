import whisper
import os

class Transcription:

#como eu quero que o dispositivo e o modelo sejam sempre a cpu e o base, passo direto como parametro
    def __init__(self, device = "cpu", model = "tiny"):

# 1. Garante que o FFmpeg seja encontrado no seu Mac M4
        os.environ["PATH"] += os.pathsep + '/opt/homebrew/bin'

# 2. Configura o dispositivo para a GPU do seu chip M4 (MPS)
        self.device = device

# 3. Carrega o modelo (agora vai ser instantâneo porque já está no cache)
        self.model = whisper.load_model(model).to(self.device)

# 4. Transcreve o arquivo (certifique-se que o nome é audio.mp3)
    def transcribe(self,audio_way):

        #security verification:
        if not os.path.exists(audio_way):
            return f"❌ Erro: O arquivo '{audio_way}' não foi encontrado."

        print("Transcrevendo...")


        try:
        # O parâmetro verbose=True ajuda a ver o progresso linha a linha
            usuary_text = self.model.transcribe(audio_way, fp16=False)
            clean_text = usuary_text["text"].strip()



            return clean_text

        except Exception as e:
            print(f"❌ Ocorreu um erro: {e}")
            return ""