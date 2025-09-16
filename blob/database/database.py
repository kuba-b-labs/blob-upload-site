import asyncio
import asyncpg
from pydantic import BaseModel
from dotenv import load_dotenv
from os import getenv

load_dotenv()
dbUrl = getenv("DB")
class postgres(BaseModel):
    """SQL command execution"""

    async def __aenter__(self):
        self.pool = await asyncpg.create_pool( dbUrl )
        return self
    async def __aexit__(self):
        self.pool.close()
    
    async def addUser(self, username: str):
        async with self.pool.acquire() as dbConnection:
            sql = """INSERT INTO USERS(username) VALUES($1)"""
            try:
                await dbConnection.execute(sql, username)
            except Exception:
                return "User has not been added"
            return "User added succesfully"
        
    async def getUser(self, username: str):
        async with self.pool.acquire() as dbConnection:
            sql = "SELECT id FROM users WHERE username = $1"
            result = await dbConnection.fetchrow(sql, username)
            if result is None:
                return None
            return result["id"]

    
    async def getContainer(self, containerName: str):
        async with self.pool.acquire() as dbConnection:
            sql = """
            SELECT ID from CONTAINERS 
            WHERE name = $1
            """
            result = await dbConnection.fetchrow(sql, containerName)
            if result is None:
                return "Container not found"
            return result["id"]
        
    async def addPermissions(self, containerName: str, username: str, permissions: set[str]| None = None,):
        """Add new permisions to a user"""
        if permissions is None:
            permissions = ("read","write")
            userId = await self.getUser( username )
            containerId = await self.getContainer( containerName )
        async with self.pool.acquire() as dbConnection:
            sql = """
            INSERT INTO ACL VALUES ($1,$2,$3)
            """
            try:
                for i in permissions:
                    await dbConnection.execute( sql, containerId, userId, permissions.pop )
            except Exception:
                return "ACL has not been added"
        return "ACL has been added"
    
    async def addContainer(self, containerName: str, sAccountName: str):
        """Add new container and its permissions"""
        async with self.pool.acquire() as dbConnection:
            sql = """
            INSERT INTO CONTAINERS(name,saccount) VALUES($1,$2)
            """
            try:
                await dbConnection.execute( containerName, sAccountName )
            except Exception:
                return "Container has not been added"
        return "Container has been added"
    
    async def rmUser(self, username: str):
        async with self.pool.acquire() as dbConnection:
            sql = """
            DELETE FROM USERS
            WHERE USERNAME = $1
            """
            try:
                await dbConnection.execute(sql, username)
            except Exception:
                return "User not deleted"
        return "User deleted"

    async def rmPermissions( self, username: str , containerName: str ):
        """Remove container permissions"""
        async with self.pool.acquire() as dbConnection:
            sql = """
            DELETE FROM ACL
            WHERE USER_ID = $1 and CONTAINER_ID = $2
            """
            userId = self.getUser(username)
            containerId = self.getContainer(containerName)
            try:
                await dbConnection.execute( sql, userId, containerId)
            except Exception:
                return "Permissions not removed"
        return "Permissions removed"
    async def rmContainer(self, containerName: str):
        """Remove container and its permissions"""
        async with self.pool.acquire() as dbConnection:
            sql = """
            DELETE FROM CONTAINERS
            WHERE NAME = $1
            """
            try:
                await dbConnection.execute( sql, containerName )
            except Exception:
                return "Container not deleted"
        return "Container deleted"

