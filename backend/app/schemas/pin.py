from pydantic import BaseModel, Field


class PinInput(BaseModel):
    pin: str = Field(..., min_length=1)


class PinStatus(BaseModel):
    has_pin: bool
