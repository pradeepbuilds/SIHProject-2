import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

from backend.config import settings
from ml.inference.serve import load_models
from backend.routers import (
    health,
    regions,
    locations,
    weather,
    prediction,
    advisory,
    model,
    map_layer,
    scenarios,
    analytics
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    print(f"Starting {settings.PROJECT_NAME} (v{settings.VERSION})...")
    print(f"Tagline: {settings.TAGLINE}")
    load_models()
    yield
    print(f"Shutting down {settings.PROJECT_NAME}...")


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="KrishiMitra — Weather intelligence for every panchayat. Multi-region downscaling ML API.",
    version=settings.VERSION,
    lifespan=lifespan
)

# CORS Middleware to allow React Frontend connectivity
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Structured Error Handlers: {"error": {"code": "...", "message": "..."}}
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    detail = exc.detail
    if isinstance(detail, dict) and "error" in detail:
        return JSONResponse(status_code=exc.status_code, content={"detail": detail, **detail})
    elif isinstance(detail, dict):
        return JSONResponse(status_code=exc.status_code, content={"detail": detail, "error": detail})
    else:
        code = "not_found" if exc.status_code == 404 else (
            "unauthorized" if exc.status_code == 401 else (
                "forbidden" if exc.status_code == 403 else (
                    "bad_request" if exc.status_code == 400 else "error"
                )
            )
        )
        err = {"code": code, "message": str(detail)}
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": {"error": err}, "error": err}
        )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    msg = errors[0].get("msg", "Invalid request parameters") if errors else "Validation error"
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": {
                "code": "validation_error",
                "message": msg,
                "details": str(errors)
            }
        }
    )


# Include all API Routers (both root and /api prefix for proxy transparency)
api_routers = [
    health.router,
    regions.router,
    locations.router,
    weather.router,
    prediction.router,
    advisory.router,
    model.router,
    map_layer.router,
    scenarios.router,
    analytics.router
]

for r in api_routers:
    app.include_router(r)
    app.include_router(r, prefix="/api")

