
from catch import Catch
from IntegradeAI import IntegradeAI
from Answer import Answer
from transcription import Transcription
import os
from dotenv import load_dotenv

def inicializate():

    load_dotenv() #carrega as variveis do aqui env para a memoria

    captar = Catch()
    transcrito = Transcription()

    api_key = os.getenv("API_KEY")  #pega a chave de forma segura
    if not api_key:
        raise ValueError("❌ ERRO: A chave da API não foi encontrada no arquivo .env!")

    pensar = IntegradeAI(api_key)

    resposta = Answer()

    print("\n--- Assistente Ativo ---")
    print("Para sair, pressione Ctrl + C a qualquer momento.")


    try:
        while True:
            input("Press ENTER to talk or ctrl + c to leave")

            #gravo sem tempo fixo
            arquivo_audio = captar.record()


            #transcrever
            texto_usuario = transcrito.transcribe(arquivo_audio)
            if not texto_usuario.strip():
                continue

            print(f"👤 Você: {texto_usuario}")


            #pensar
            respostaIA = pensar.predict(texto_usuario)

            #chama funcao que printa a resposta
            resposta.falar(respostaIA, idioma="en")

    except KeyboardInterrupt:
        print("\nPrograma finalizado com sucesso!")

if __name__ == "__main__":
    inicializate()







