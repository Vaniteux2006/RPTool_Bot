import requests
from PIL import Image, ImageDraw, ImageFont, ImageOps
from io import BytesIO
import textwrap

# --- CONFIGURAÇÕES VISUAIS ---
FONT_PATH = "fonts/GreaterTheory.otf" # CERTIFIQUE-SE QUE ESSE ARQUIVO EXISTE!
CANVAS_WIDTH = 1000
CANVAS_HEIGHT = 400
AVATAR_SIZE = 250

def load_font(size):
    try:
        return ImageFont.truetype(FONT_PATH, size)
    except OSError:
        # Tenta Arial se não achar a MPlus (Windows/Linux fallback)
        try:
            return ImageFont.truetype("arial.ttf", size)
        except:
            return ImageFont.load_default()

def create_circular_avatar(image, size):
    # Redimensiona com alta qualidade (Lanczos)
    image = image.resize((size, size), Image.Resampling.LANCZOS)
    
    # Cria uma máscara circular de alta resolução (4x) para suavizar bordas (Anti-aliasing)
    mask = Image.new('L', (size * 4, size * 4), 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((0, 0, size * 4, size * 4), fill=255)
    mask = mask.resize((size, size), Image.Resampling.LANCZOS)
    
    # Aplica a máscara
    output = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    output.paste(image, (0, 0), mask)
    return output

def render_quote(text, username, avatar_url, user_color_hex, options):
    # Opções
    dark_mode = options.get("dark_mode", True)
    grayscale = options.get("grayscale", False)
    # Ignorando flip/vertical por enquanto para focar na qualidade do básico
    
    # 1. Canvas e Cores
    if dark_mode:
        bg_color = (20, 20, 20) # Preto suave (não #000000)
        text_color = (255, 255, 255)
        subtext_color = (180, 180, 180)
    else:
        bg_color = (240, 240, 240) # Branco gelo
        text_color = (30, 30, 30)
        subtext_color = (80, 80, 80)
        
    canvas = Image.new("RGBA", (CANVAS_WIDTH, CANVAS_HEIGHT), bg_color)
    draw = ImageDraw.Draw(canvas)

    # 2. Processar Avatar
    try:
        response = requests.get(avatar_url, timeout=5)
        avatar_raw = Image.open(BytesIO(response.content)).convert("RGBA")
    except:
        avatar_raw = Image.new("RGBA", (AVATAR_SIZE, AVATAR_SIZE), (100, 100, 100))

    if grayscale:
        avatar_raw = ImageOps.grayscale(avatar_raw).convert("RGBA")

    avatar = create_circular_avatar(avatar_raw, AVATAR_SIZE)

    # 3. Posicionamento (Layout Clássico Esquerda -> Direita)
    # Avatar na esquerda, verticalmente centralizado
    avatar_x = 50
    avatar_y = (CANVAS_HEIGHT - AVATAR_SIZE) // 2
    canvas.paste(avatar, (avatar_x, avatar_y), avatar)

    # 4. Renderizar Texto (Lado Direito)
    # Área de texto começa depois do avatar + padding
    text_area_start = avatar_x + AVATAR_SIZE + 50
    text_area_width = CANVAS_WIDTH - text_area_start - 50 # Margem direita
    
    # Fontes
    font_size_main = 50
    font_main = load_font(font_size_main)
    font_author = load_font(30)
    
    # Quebra de Linha Inteligente
    # Precisamos "adivinhar" quantos caracteres cabem. 
    # Média de pixels por char ~ font_size / 2.
    chars_per_line = int(text_area_width / (font_size_main * 0.5))
    wrapper = textwrap.TextWrapper(width=chars_per_line)
    lines = wrapper.wrap(text)
    
    # Calcular altura total do bloco de texto para centralizar verticalmente
    line_height = font_size_main + 10
    total_text_height = (len(lines) * line_height) + 50 # +50 pro nome do autor
    
    start_y = (CANVAS_HEIGHT - total_text_height) // 2
    
    current_y = start_y
    for line in lines:
        draw.text((text_area_start, current_y), line, font=font_main, fill=text_color)
        current_y += line_height
        
    # Renderizar Nome do Autor
    # Se o Discord mandou cor em INT, converte, se mandou HEX, usa.
    # Fallback simples pra garantir que não quebre
    try:
        if not user_color_hex.startswith("#"):
             user_color_hex = text_color
    except:
        user_color_hex = text_color

    draw.text((text_area_start, current_y + 15), f"- {username}", font=font_author, fill=user_color_hex)
    
    # Marca d'água pequena no canto
    font_watermark = load_font(15)
    draw.text((CANVAS_WIDTH - 150, CANVAS_HEIGHT - 30), "RPTool Quote", font=font_watermark, fill=subtext_color)

    # 5. Output
    output = BytesIO()
    canvas.save(output, format="PNG")
    output.seek(0)
    return output