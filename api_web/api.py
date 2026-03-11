import uvicorn
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel #BIBLIOTECA DE VALIDACAO DE DADOS QUE USA TYPE HINTS(DICAS DE TIPO)

from core.IntegradeAI import IntegradeAI


app = FastAPI(title="Spazer AI - English Tutor API")
IA_Tutor = IntegradeAI()

class Mensagem(BaseModel): #CRIO UM CONTRATO DE API, EXIGO UM CAMPO CHAMADO TEXTO E ELE DEVE SER STRING
    texto: str #Se nao for string, ele ja envia o erro(e falar oq faltou) sem eu precisar escrever nada
#pega  o JSON puro e transforma em um objeto de python
@app.get("/")

def home():
    return {"status" : "Online", "model": "DeepSeek-R1 via Ollama"} #aparece no local host
@app.post("/chat")

def conversar(msg : Mensagem):

   try:
      #validacao, pydantic ja garantiu que é uma string porem temos que checar se esta vazia oou nao
      if not msg.texto.strip():
          raise HTTPException(status_code=400, detail="A Mensagem nao pode estar vazia")

      print(f"User: {msg.texto}")

      resposta = IA_Tutor.predict(msg.texto)
      print(f"AI answe: {resposta}")

      #retonar JSON estruturado para o frontend
      return {
          "status" : "sucess",
           "user message": msg.texto,
           "ai_answer": resposta
      }

   except Exception as e:
       print(f"ERROR: {e}")
       raise HTTPException(status_code=500, detail=f"Erro interno no servidor: {str(e)}")

if __name__ == "__main__":
    #Rodando o servidor localmente
    uvicorn.run(app,host="127.0.0.1",port=8000)