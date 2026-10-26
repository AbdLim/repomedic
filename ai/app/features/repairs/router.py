from fastapi import APIRouter, Depends, HTTPException

from app.core.security import require_internal_key
from app.features.repairs.schemas import RepairRequest, RepairResult
from app.features.repairs.service import RepairService

# from app.infrastructure.llm.nebius import NebiusProvider

router = APIRouter(prefix="/internal", dependencies=[Depends(require_internal_key)])


# @router.get("/ai/ping")
# async def ai_ping() -> dict[str, str]:
#     return {"response": await NebiusProvider().ping()}


@router.post("/repairs/run", response_model=RepairResult)
async def run_repair(payload: RepairRequest) -> RepairResult:
    try:
        return await RepairService().run(payload.issue_url, environment=payload.environment)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
