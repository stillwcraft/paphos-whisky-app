from datetime import datetime
from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator


class AnimationConfig(BaseModel):
    type: Literal["slide_up", "slide_down", "slide_left", "slide_right", "fade_in", "fade_in_out", "zoom_in", "pulse"]
    delay: float = Field(default=0.0, ge=0)
    duration: float = Field(default=0.5, gt=0)

    @model_validator(mode="before")
    @classmethod
    def default_animation_duration(cls, value):
        if isinstance(value, dict) and "duration" not in value:
            duration = {"fade_in_out": 1.1, "pulse": 2.0}.get(value.get("type"))
            if duration is not None:
                return {**value, "duration": duration}
        return value


class PositionConfig(BaseModel):
    top: Optional[str] = None
    bottom: Optional[str] = None
    left: Optional[str] = None
    right: Optional[str] = None
    width: Optional[str] = "auto"
    height: Optional[str] = "auto"
    z_index: int = 10
    transform: Optional[str] = None


class TextStyleConfig(BaseModel):
    font_size: Optional[str] = "16px"
    color: Optional[str] = "#FFE28A"
    font_family: Optional[str] = "Cinzel"
    font_weight: Optional[str] = "normal"
    text_align: Optional[Literal["left", "center", "right"]] = "left"


class SlideElement(BaseModel):
    id: str
    type: Literal["image", "text", "badge", "logo"]
    src: Optional[str] = None
    content: Optional[Dict[str, str]] = None
    style: Optional[TextStyleConfig] = None
    position: PositionConfig
    animations: List[AnimationConfig] = Field(default_factory=list)

    @model_validator(mode="before")
    @classmethod
    def normalize_legacy_animation(cls, value):
        if isinstance(value, dict) and "animations" not in value and "animation" in value:
            legacy = value["animation"]
            return {**value, "animations": legacy if isinstance(legacy, list) else
                    [legacy] if legacy is not None else []}
        return value


class BackgroundConfig(BaseModel):
    type: Literal["color", "gradient", "image"] = "color"
    value: str = "#0a0a0c"
    overlay_opacity: Optional[float] = Field(default=None, ge=0.0, le=1.0)


class InteractiveSlide(BaseModel):
    slide_index: int
    elements: List[SlideElement]


class ArticleBase(BaseModel):
    title: Dict[str, str]
    content: Dict[str, str] = Field(default_factory=dict)
    type: str = "news"
    format: Literal["standard", "interactive_presentation"] = "standard"
    image_urls: List[str] = Field(default_factory=list)
    is_published: bool = True
    background_config: Optional[BackgroundConfig] = Field(default_factory=BackgroundConfig)
    slides_data: List[InteractiveSlide] = Field(default_factory=list)


class ArticleCreate(ArticleBase):
    pass


class ArticleUpdate(BaseModel):
    title: Optional[Dict[str, str]] = None
    content: Optional[Dict[str, str]] = None
    type: Optional[str] = None
    format: Optional[Literal["standard", "interactive_presentation"]] = None
    image_urls: Optional[List[str]] = None
    is_published: Optional[bool] = None
    background_config: Optional[BackgroundConfig] = None
    slides_data: Optional[List[InteractiveSlide]] = None


class ArticleResponse(ArticleBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime
