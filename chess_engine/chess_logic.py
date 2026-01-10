import os
import chess # Nova biblioteca para traduzir o lance
from stockfish import Stockfish

class ChessBot:
    def __init__(self):
        self.engine = None
        self.load_engine()

    def load_engine(self):
        current_dir = os.path.dirname(os.path.abspath(__file__))
        exe_path = os.path.join(current_dir, "stockfish.exe")

        print(f"[XADREZ] Tentando carregar Stockfish em: {exe_path}")

        if os.path.exists(exe_path):
            try:
                self.engine = Stockfish(path=exe_path, depth=15, parameters={"Threads": 2, "Hash": 16})
                print("[XADREZ] Stockfish carregado e pronto!")
            except Exception as e:
                print(f"[XADREZ] Erro ao iniciar binario: {e}")
        else:
            print("[XADREZ] Erro: Arquivo 'stockfish.exe' nao encontrado.")

    def analyze(self, fen):
        if not self.engine:
            return {"error": "Engine offline"}

        try:
            # 1. Configura a Engine
            if fen == "start":
                fen = chess.STARTING_FEN # Usa o FEN oficial de inicio
                self.engine.set_position()
            else:
                if not self.engine.is_fen_valid(fen):
                    return {"error": "FEN Invalido"}
                self.engine.set_fen_position(fen)

            # 2. Pega o lance em "Língua de Robô" (Ex: h5f7)
            best_move_uci = self.engine.get_best_move()
            
            # 3. TRADUÇÃO PARA HUMANO (SAN)
            # Criamos um tabuleiro virtual no Python pra ele entender o contexto
            board = chess.Board(fen)
            move_object = chess.Move.from_uci(best_move_uci)
            san_move = board.san(move_object) # Aqui vira "Qxf7+"

            evaluation = self.engine.get_evaluation()
            
            return {
                "best_move": san_move, # Agora mandamos o "Qxf7+" aqui!
                "uci": best_move_uci,  # Mandamos o original tbm só por segurança
                "evaluation": evaluation,
                "fen": self.engine.get_fen_position()
            }
        except Exception as e:
            return {"error": str(e)}