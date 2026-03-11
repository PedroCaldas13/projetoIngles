import sys
import customtkinter as ctk
import threading
from core.catch import Catch
from  core.transcription import Transcription
from core.IntegradeAI import IntegradeAI
from core.Answer import Answer

class SpazerApp(ctk.CTk):
    def __init__(self):
        super().__init__() #super chamo o construtor da classse pai

        #configuracao da janela
        self.title("Spazer AI -English Tutor")
        self.geometry("600x650")
        ctk.set_appearance_mode("dark")
        ctk.set_default_color_theme("blue")


        #iniciando as classes

        self.catch = Catch()
        self.ia = IntegradeAI()
        self.transcription = Transcription()
        self.ans = Answer()

        #estado do botao
        self.is_recording = False


        # --- Elementos da UI ---
        self.label = ctk.CTkLabel(self, text="🗣️ English Tutor (M4 Local)", font=("Helvetica", 22, "bold"))
        self.label.pack(pady=20)

        self.chat_box = ctk.CTkTextbox(self, width=500, height=250)
        self.chat_box.pack(pady=10)

        self.btn_action = ctk.CTkButton(self, text="🎙️ Start Recording",
                                        command=self.handle_click,
                                        height=50, font=("Helvetica", 16))
        self.btn_action.pack(pady=20)

        self.status_label = ctk.CTkLabel(self, text="Status: Ready", text_color="green")
        self.status_label.pack()

        #NOVOS BOTOES
        self.control_frame = ctk.CTkFrame(self,fg_color= "transparent")
        self.control_frame.pack(pady=20)

        self.btn_reset = ctk.CTkButton(self.control_frame, text="🔄 Reset Chat",
                                       command=self.reset_conversation,
                                       fg_color="#34495e", hover_color="#2c3e50", width=120)

        self.btn_reset.grid(row=0,column=0,padx=10)

        self.btn_exit = ctk.CTkButton(self.control_frame, text="❌ Exit",
                                      command=self.exit_app,
                                      fg_color="#7f8c8d", hover_color="#95a5a6", width=120)
        self.btn_exit.grid(row=0, column=1, padx=10)

    def reset_conversation(self):
        #limpa a interface e a memoria da IA

        #limpa a caixa de texto
        self.chat_box.delete("0.0","end")

        #Reseta a memoria do deepseek(mantem apenas o prompt)
        self.ia.messages =[{'role': 'system', 'content': self.ia.system_prompt} ]

        self.status_label.configure(text="Status: Conversation Reset", text_color= "cyan")
        print("Historico e memoria da IA apagados")

    def exit_app(self):
        #fecha o programa corretamente
        print("End...")
        self.destroy()
        sys.exit(0)



    def handle_click(self):
        #alterno entre gravar e processar
        if not self.is_recording:
            #comeco a gravar
            self.is_recording = True
            self.btn_action.configure(text="Stop & Process",fg_color="#c0392b")
            self.status_label.configure(text="Status: Listening...", text_color="red")
            self.catch.start_recording()
        else:
            #PARO E ENVIO PARA A IA
            self.is_recording = False
            self.btn_action.configure(text="Thinking", state="disabled", fg_color="gray")
            self.status_label.configure(text="Status: Processing audio", text_color="orange")

            #Rodar o procesamento em um thread e a UI em outro
            threading.Thread(target=self.run_ai_pipeline,daemon=True).start()

    def run_ai_pipeline(self):
        #pipeline de processamento
        try:
            path = self.catch.stop_recording()

            user_text = self.transcription.transcribe(path)
            # after(0, ...) garante que a UI atualize sem conflito de threads
            self.after(0, self.update_chat, "You", user_text)

            ai_text = self.ia.predict(user_text)
            self.after(0, self.update_chat, "AI", ai_text)

            # Atualiza status e FALA (agora o código chega aqui!)
            self.after(0, lambda: self.status_label.configure(text="Status: Speaking", text_color="blue"))

            # Chama a voz (o Answer.py deve usar o 'say' do Mac)
            self.ans.falar(ai_text)

        except Exception as e:
            self.update_chat("System",f"Error: {e}") #update chat mostra algo novo
        finally:
            self.btn_action.configure(state="normal", text="🎙️ Start Recording", fg_color="#1f538d")
            self.status_label.configure(text="Status: Ready", text_color="green")


    def update_chat(self,sender,msg):
        self.chat_box.insert("end",f"{sender}: {msg}\n\n")
        self.chat_box.see("end")

if __name__ == "__main__":
    app = SpazerApp()
    app.mainloop()


