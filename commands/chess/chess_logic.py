import os
import chess 
from stockfish import Stockfish

class ChessBot:
    def __init__(self):
        self.engine = None
        self.load_engine()

    def load_engine(self):
        current_dir = os.path.dirname(os.path.abspath(__file__))
        local_exe = os.path.join(current_dir, "stockfish.exe" if os.name == 'nt' else "stockfish")
        system_exe = "/usr/games/stockfish" 

        path_to_use = local_exe if os.path.exists(local_exe) else (system_exe if os.path.exists(system_exe) else None)
        
        if path_to_use:
            try:
                self.engine = Stockfish(path=path_to_use, depth=15, parameters={"Threads": 2, "Hash": 16})
                print("[XADREZ] Stockfish carregado!")
            except Exception as e:
                print(f"[XADREZ] Erro ao iniciar: {e}")
        else:
            print("[XADREZ] ERRO CRÍTICO: Stockfish não encontrado.")

    def play_turn(self, fen, user_move):
        if not self.engine: return {"error": "Engine offline"}
        
        board = chess.Board(fen)

        try:
            move = board.push_san(user_move)
        except ValueError:
            return {"error": "Movimento inválido ou ilegal."}

        if board.is_game_over():
            return {"fen": board.fen(), "game_over": True, "result": board.result(), "message": "Fim de jogo após seu lance!"}

        self.engine.set_fen_position(board.fen())
        bot_best_move_uci = self.engine.get_best_move()
        
        if bot_best_move_uci:
            board.push_uci(bot_best_move_uci)
            bot_move_san = board.peek() 
        else:
            return {"error": "Stockfish não encontrou lance (Mate?)"}

        evaluation = self.engine.get_evaluation()
        return {
            "fen": board.fen(),
            "bot_move": str(bot_move_san), 
            "evaluation": evaluation,
            "game_over": board.is_game_over()
        }

    def analyze(self, fen):
        if not self.engine: return {"error": "Engine offline"}
        try:
            if fen == "start": fen = chess.STARTING_FEN 
            self.engine.set_fen_position(fen)
            best = self.engine.get_best_move()
            eval_val = self.engine.get_evaluation()
            return {"best_move": best, "evaluation": eval_val, "fen": fen}
        except Exception as e:
            return {"error": str(e)}