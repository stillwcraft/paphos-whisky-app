"""Authoring DSL. Public slides are serialized with an explicit field allowlist."""
from typing import Annotated, Literal, Optional, Union
from urllib.parse import urlsplit

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator, model_validator

Identifier = Annotated[str, StringConstraints(pattern=r"^[a-zA-Z0-9_-]{1,64}$")]
MediaURL = Annotated[str, StringConstraints(max_length=2048)]
Localized = dict[str, str]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Animations(StrictModel):
    entry: Literal["fade", "rise", "none"] = "fade"
    staggerDelay: float = Field(default=0, ge=0, le=1)


class BaseSlideConfig(StrictModel):
    id: Identifier
    title: Optional[Localized] = None
    animations: Optional[Animations] = None


class Photo(StrictModel):
    url: MediaURL
    alt: Localized = Field(default_factory=dict)

    @field_validator("url")
    @classmethod
    def https_only(cls, value):
        parsed = urlsplit(value)
        if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
            raise ValueError("Media must use an HTTPS URL without credentials")
        return value


class StaticSlideConfig(BaseSlideConfig):
    type: Literal["static"]
    html: str = Field(default="", max_length=50000)
    css: str = Field(default="", max_length=10000)
    image: Optional[Photo] = None


class VideoSlideConfig(BaseSlideConfig):
    type: Literal["video"]
    video: Photo
    autoplay: Literal[True] = True
    muted: Literal[True] = True


class GallerySlideConfig(BaseSlideConfig):
    type: Literal["gallery"]
    photos: list[Photo] = Field(min_length=1, max_length=30)


class Tab(StrictModel):
    id: Identifier
    label: Localized
    html: str = Field(default="", max_length=50000)
    route: Optional[Literal["events", "articles", "map", "cyprus-map", "distilleries", "bottles", "profile"]] = None


class InteractiveTabsSlideConfig(BaseSlideConfig):
    type: Literal["interactive_tabs"]
    tabs: list[Tab] = Field(min_length=1, max_length=10)

    @model_validator(mode="after")
    def unique_tabs(self):
        if len({tab.id for tab in self.tabs}) != len(self.tabs):
            raise ValueError("Tab IDs must be unique")
        return self


class PollOption(StrictModel):
    id: Identifier
    label: Localized


class PollSlideConfig(BaseSlideConfig):
    type: Literal["poll"]
    question: Localized
    options: list[PollOption] = Field(min_length=2, max_length=10)
    answers: list[Identifier] = Field(default_factory=list)

    @model_validator(mode="after")
    def valid_options(self):
        ids = {option.id for option in self.options}
        if len(ids) != len(self.options) or not set(self.answers).issubset(ids):
            raise ValueError("Option IDs must be unique and answers must reference options")
        return self


class WordCloudSlideConfig(BaseSlideConfig):
    type: Literal["word_cloud"]
    prompt: Localized
    max_words: int = Field(default=3, ge=1, le=3)


SlideConfig = Annotated[Union[
    StaticSlideConfig, VideoSlideConfig, GallerySlideConfig,
    InteractiveTabsSlideConfig, PollSlideConfig, WordCloudSlideConfig,
], Field(discriminator="type")]


class PresentationManifest(StrictModel):
    id: Identifier
    slides: list[SlideConfig] = Field(min_length=1, max_length=100)

    @model_validator(mode="after")
    def unique_slides(self):
        if len({slide.id for slide in self.slides}) != len(self.slides):
            raise ValueError("Slide IDs must be unique")
        return self


PUBLIC_FIELDS = {
    "static": {"html", "css", "image"},
    "video": {"video", "autoplay", "muted"},
    "gallery": {"photos"},
    "interactive_tabs": {"tabs"},
    "poll": {"question", "options"},
    "word_cloud": {"prompt", "max_words"},
}


def public_slide(slide: SlideConfig) -> dict:
    return slide.model_dump(include={"id", "type", "title", "animations"} | PUBLIC_FIELDS[slide.type])


class Command(StrictModel):
    type: Literal["sync", "ping", "advance", "vote", "words"]
    index: Optional[int] = Field(default=None, ge=0, strict=True)
    slide_id: Optional[Identifier] = None
    option_id: Optional[Identifier] = None
    words: list[Annotated[str, StringConstraints(min_length=1, max_length=32)]] = Field(default_factory=list, max_length=3)
