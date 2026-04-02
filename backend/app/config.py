from dotenv import load_dotenv
load_dotenv(".env", override=True)

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_env: str = "development"
    app_host: str = "0.0.0.0"
    app_port: int = 8001

    allowed_origins: str = "http://localhost:3000"

    supabase_url: str = ""
    supabase_secret_key: str = ""
    supabase_jwt_secret: str = ""

    @property
    def origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",")]

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
