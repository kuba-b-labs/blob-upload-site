import asyncio
import asyncpg
from pydantic import BaseModel
from dotenv import load_dotenv
from os import getenv

load_dotenv()

class postgres(BaseModel):
    """SQL command execution"""

    async def __aenter__(self):
        self.pool = await asyncpg.create_pool("postgresql://postgres:mysecretpassword@localhost:5432/postgres")
        return self
    async def __aexit__(self):
        self.pool.close()
    
    async def addUser():
        return
    async def getUser():
        user = ""
        return user
    async def addPermissions():
        """Add new permisions to a user"""
        return
    async def addContainer():
        """Add new container and its permissions"""
        return
    async def rmUser():
        return
    async def rmPermissions():
        """Remove container permissions"""
        return
    async def rmContainer():
        """Remove container and its permissions"""
        return

