from fastapi import APIRouter

router = APIRouter(tags=["Health"])


@router.get("/")
@router.get("/health")
def health_check():
    return {"status": "ok"}
