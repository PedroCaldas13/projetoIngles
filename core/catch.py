import numpy as np
import sounddevice as sd
import soundfile as sf
import os

from setuptools.command.bdist_egg import can_scan


class Catch():

    #abrir o arquivo de audio
    def __init__(self, taxa_amostragem = 44100,  canais = 1):
        """
        Inicializa o captador  de adulto:
        :param taxa_amostragem: padrao CD
        :param canais:
        """

        self.fs = taxa_amostragem #objeto fs recebe o parametro taxa
        self.channels = canais # objeto channels recebe o parametro canais
        self.dados_audio = []
        self.stream = None

    def callback(self,indata, frames, time, status):
        self.dados_audio.append(indata.copy())

    def start_recording(self):
        self.dados_audio = []
        self.stream = sd.InputStream(samplerate=self.fs,channels=self.channels ,callback=self.callback)
        self.stream.start()

    def stop_recording(self, nome_arquivo = "audio.wav"):
        if self.stream:
            self.stream.stop()
            self.stream.close()
            self.stream = None

            if len(self.dados_audio) == 0:
                return None

        #transforma a lista de pedacos em um unico arquivo
        final_record = np.concatenate(self.dados_audio, axis=0)
        sf.write(nome_arquivo, final_record, self.fs)
        return os.path.abspath(nome_arquivo)

