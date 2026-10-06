export interface AnimationConfig {
  type: 'slide_up' | 'slide_down' | 'slide_left' | 'slide_right' | 'fade_in' | 'fade_in_out' | 'zoom_in' | 'pulse';
  delay: number;
  duration: number;
}

export interface PositionConfig {
  top?: string | null;
  bottom?: string | null;
  left?: string | null;
  right?: string | null;
  width?: string | null;
  height?: string | null;
  z_index?: number;
  transform?: string | null;
}

export interface TextStyleConfig {
  font_size?: string | null;
  color?: string | null;
  font_family?: string | null;
  font_weight?: string | null;
  text_align?: 'left' | 'center' | 'right' | null;
}

export interface SlideElement {
  id: string;
  type: 'image' | 'text' | 'badge' | 'logo';
  src?: string | null;
  content?: Record<string, string> | null;
  style?: TextStyleConfig | null;
  position: PositionConfig;
  animation?: AnimationConfig | null;
}

export interface BackgroundConfig {
  type: 'color' | 'gradient' | 'image';
  value: string;
  overlay_opacity?: number | null;
}

export interface InteractiveSlide {
  slide_index: number;
  elements: SlideElement[];
}

export interface Article {
  id: number;
  title: string;
  content: string;
  type: 'article' | 'news';
  image_urls: string[];
  created_at: string;
  format?: 'standard' | 'interactive_presentation';
  background_config?: BackgroundConfig | null;
  slides_data?: InteractiveSlide[];
}
