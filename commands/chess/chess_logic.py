import os
import chess 
from stockfish import Stockfish

class ChessBot:
    def __init__(self):
        self.engine = None
        self.load_engine()

    def load_engine(self):
        current_dir = os.path.dirname(os.path.abspath(__file__))
        
        # Tenta achar o executável local (Windows ou Linux binário local)
        local_exe = os.path.join(current_dir, "stockfish.exe" if os.name == 'nt' else "stockfish")
        
        # Caminho padrão do Linux instalado via apt
        system_exe = "/usr/games/stockfish" 

        path_to_use = None

        if os.path.exists(local_exe):
            path_to_use = local_exe
            print(f"[XADREZ] Usando binário local: {path_to_use}")
        elif os.path.exists(system_exe):
            path_to_use = system_exe
            print(f"[XADREZ] Usando Stockfish do sistema: {path_to_use}")
        
        if path_to_use:
            try:
                self.engine = Stockfish(path=path_to_use, depth=15, parameters={"Threads": 2, "Hash": 16})
                print("[XADREZ] Stockfish carregado e pronto!")
            except Exception as e:
                print(f"[XADREZ] Erro ao iniciar binario: {e}")
        else:
            print("[XADREZ] ERRO CRÍTICO: Não achei o Stockfish (nem local, nem no sistema).")

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