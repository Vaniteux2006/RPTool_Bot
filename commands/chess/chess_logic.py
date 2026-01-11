import os
import chess 
from stockfish import Stockfish

class ChessBot:
    def __init__(self):
        self.engine = None
        self.load_engine()

    def load_engine(self):
        # Como o script e o executável estão JUNTOS na pasta Commands/chess,
        # basta pegar o diretório atual do arquivo.
        current_dir = os.path.dirname(os.path.abspath(__file__))
        exe_path = os.path.join(current_dir, "stockfish.exe")

        print(f"[XADREZ] Procurando Stockfish em: {exe_path}")

        if os.path.exists(exe_path):
            try:
                self.engine = Stockfish(path=exe_path, depth=15, parameters={"Threads": 2, "Hash": 16})
                print("[XADREZ] Stockfish carregado e pronto!")
            except Exception as e:
                print(f"[XADREZ] Erro ao iniciar binario: {e}")
        else:
            print("[XADREZ] ERRO CRÍTICO: Não achei o stockfish.exe aqui do meu lado.")

    def analyze(self, fen):
        if not self.engine:
            return {"error": "Engine offline"}

        try:
            if fen == "start":
                fen = chess.STARTING_FEN 
                self.engine.set_position()
            else:
                if not self.engine.is_fen_valid(fen):
                    return {"error": "FEN Invalido"}
                self.engine.set_fen_position(fen)

            best_move_uci = self.engine.get_best_move()
            
            board = chess.Board(fen)
            move_object = chess.Move.from_uci(best_move_uci)
            san_move = board.san(move_object) 

            evaluation = self.engine.get_evaluation()
            
            return {
                "best_move": san_move, 
                "uci": best_move_uci,
                "evaluation": evaluation,
                "fen": self.engine.get_fen_position()
            }
        except Exception as e:
            return {"error": str(e)}