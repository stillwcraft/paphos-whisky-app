import numpy as np
from PIL import Image


def recolor_logo_to_gold(input_path, output_path, gold_hex="#C5A059"):
    # Конвертируем HEX в RGB
    hex_clean = gold_hex.lstrip('#')
    target_rgb = tuple(int(hex_clean[i:i + 2], 16) for i in (0, 2, 4))

    img = Image.open(input_path).convert('RGBA')
    data = np.array(img)

    r, g, b, a = data[:, :, 0], data[:, :, 1], data[:, :, 2], data[:, :, 3]
    gray = (0.299 * r + 0.587 * g + 0.114 * b).astype(np.float32)

    # Расчет альфа-канала с сохранением антиалиасинга
    if np.all(a == 255):
        text_alpha = (255.0 - gray).clip(0, 255).astype(np.uint8)
    else:
        text_alpha = ((255.0 - gray) * (a / 255.0)).clip(0, 255).astype(np.uint8)

    new_data = np.zeros_like(data)
    new_data[:, :, 0], new_data[:, :, 1], new_data[:, :, 2] = target_rgb
    new_data[:, :, 3] = text_alpha

    Image.fromarray(new_data, mode='RGBA').save(output_path)

# Использование:
# recolor_logo_to_gold('ardbeg_logo.png', 'ardbeg_gold.png')