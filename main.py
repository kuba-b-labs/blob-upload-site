from blob.blob import storage
from blob.routers.auth import authRouter
from fastapi import FastAPI, UploadFile, File, APIRouter
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from mimetypes import guess_type


app = FastAPI()
app.include_router(authRouter)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/upload/{dstContainer}")
async def uploadBlob( dstContainer: str ,entry: UploadFile = File(...)):
    storageConnection = storage()
    dataToUpload = await entry.read()
    storageConnection.uploudBlockBlob( dstContainer, dataToUpload, entry.filename)
    storageConnection.close()
    return {"status" : "file uploaded" }

@app.delete("/upload/delete/{dstContainer}/{filename}")
async def deleteBlob( dstContainer: str , filename: str ):
    storageConnection = storage()
    storageConnection.deleteBlockBlob( dstContainer, filename )
    storageConnection.close()
    return {"status": "Entry successfully deleted"}


@app.get("/listblobs/{dstContainer}")
async def listBlobs( dstContainer: str ):
    storageConnection = storage()
    blobs = storageConnection.listBlobs( dstContainer )
    storageConnection.close()
    blobs_names = []
    for i in blobs:
       blobs_names.append(i.name)
    return blobs_names

@app.get("/download/{dstContainer}/{filename}")
async def downloadBlob( dstContainer: str, filename:str ):
    storageConnection = storage()
    blob = storageConnection.downloadBlob( dstContainer, filename )
    # wypakowanie tuple, bo mimetype zwraca tuple (value1, value2)
    mimeType, encoding = guess_type(filename)
    if mimeType is None:
        mimeType = "application/octet-stream"
    return StreamingResponse(
        blob.chunks(), media_type=mimeType
        )
    #return StreamingResponse(blob.chunks(), media_type="application/octet-stream")