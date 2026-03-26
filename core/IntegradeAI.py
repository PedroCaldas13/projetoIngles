import ollama# <--- A CORREÇÃO ESTÁ AQUI
import re # Importante para tipagem se precisar




class IntegradeAI:
    #the builder receives the apikey
    def __init__(self,api_key=None):

        self.model =  "deepseek-r1:7b"

        self.system_prompt= (
            "You are a friendly English tutor. "
            "Respond concisely (max 2 sentences). "
            "If the student makes a big mistake, correct it gently."
        )

        #Historico  para a IA ter memoria
        self.messages = [
            {'role': 'system', 'content': self.system_prompt},
        ]



    def predict(self, usuary_text): #receives the parameter of the transcription

        try:
            #adiciona oq eu disse ao historico
            self.messages.append({'role': 'user', 'content': usuary_text})

            print(f"DEBUG HISTORICO COMPLETO: {self.messages}")  # <-- adiciona isso
            #envia a mensagem
            response = ollama.chat(model=self.model, messages=self.messages)

            # CORREÇÃO AQUI: 'message' no singular
            if 'message' in response:
                full_response = response['message']['content']
            else:
                # Caso a biblioteca retorne como objeto em vez de dicionário
                full_response = response.message.content

            #adiciona a resposta completa para a IA nao esquecer
            self.messages.append({'role': 'assistant', 'content': full_response})

            #2 Limpeza retirar or <tags> que o deepseek pensa pra nao sair no audio
            clean_text = re.sub(r'<think>.*?</think>', '', full_response, flags=re.DOTALL).strip()

            return clean_text

        except Exception as e:
            return f"AI error: {e}"

