from datetime import datetime
from typing import Literal, Optional, Union
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, FiniteFloat, field_validator, model_validator


class InfographicPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ChartDataset(InfographicPayload):
    name: str = Field(min_length=1)
    data: list[FiniteFloat] = Field(min_length=1)
    color: Optional[str] = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")


class ChartPayload(InfographicPayload):
    chart_type: Literal["bar", "line", "pie"]
    labels: list[str] = Field(min_length=1)
    datasets: list[ChartDataset] = Field(min_length=1)
    x_axis_label: Optional[str] = None
    y_axis_label: Optional[str] = None
    animated: bool = True
    animation_delay_ms: int = Field(default=0, ge=0)

    @model_validator(mode="after")
    def validate_lengths(self):
        if any(len(dataset.data) != len(self.labels) for dataset in self.datasets):
            raise ValueError("Each dataset must have one value per label")
        if self.chart_type == "pie" and len(self.datasets) != 1:
            raise ValueError("Pie charts require exactly one dataset")
        return self


class LocalizedTimelineText(InfographicPayload):
    en: str = Field(min_length=1)
    ru: str = Field(min_length=1)
    uk: str = Field(min_length=1)


class TimelineStep(InfographicPayload):
    id: Union[str, int]
    title: Union[str, LocalizedTimelineText]
    subtitle: str
    description: Union[str, LocalizedTimelineText]
    dateOrYear: Union[str, int]
    badge: Optional[str] = None

    @field_validator("id")
    @classmethod
    def validate_id(cls, value):
        if isinstance(value, str) and not value.strip():
            raise ValueError("Timeline step id must not be empty")
        return value


class LegacyTimelineStep(InfographicPayload):
    step: int = Field(ge=1)
    title: str = Field(min_length=1)
    description: str
    badge: Optional[str] = None


class TimelinePayload(InfographicPayload):
    steps: list[Union[TimelineStep, LegacyTimelineStep]] = Field(min_length=1)

    @model_validator(mode="after")
    def validate_step_numbers(self):
        identifiers = [str(item.id if isinstance(item, TimelineStep) else item.step) for item in self.steps]
        if len(set(identifiers)) != len(self.steps):
            raise ValueError("Timeline step identifiers must be unique")
        return self


class MapMarker(InfographicPayload):
    latitude: FiniteFloat = Field(ge=-90, le=90)
    longitude: FiniteFloat = Field(ge=-180, le=180)
    title: str = Field(min_length=1)


class MapOverlayPayload(InfographicPayload):
    markers: list[MapMarker] = Field(min_length=1)


InfographicType = Literal["chart", "timeline", "map_overlay"]
SchemaData = Union[ChartPayload, TimelinePayload, MapOverlayPayload]


class InfographicCreate(BaseModel):
    title: str = Field(min_length=1)
    type: InfographicType
    schema_data: SchemaData
    distillery_id: Optional[int] = Field(default=None, gt=0)

    @model_validator(mode="after")
    def validate_schema_data(self):
        payload_type = {
            "chart": ChartPayload,
            "timeline": TimelinePayload,
            "map_overlay": MapOverlayPayload,
        }[self.type]
        if not isinstance(self.schema_data, payload_type):
            raise ValueError("schema_data does not match infographic type")
        return self


class InfographicResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    type: InfographicType
    schema_data: dict
    distillery_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
