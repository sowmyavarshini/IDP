import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

_client: Client | None = None


def get_supabase() -> Client:
    global _client
    if _client is None:
        url = os.getenv("SUPABASE_URL", "")
        key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY", "")
        print("URL:", url)
        print("SERVICE ROLE EXISTS:", bool(os.getenv("SUPABASE_SERVICE_ROLE_KEY")))
        print("ANON EXISTS:", bool(os.getenv("SUPABASE_ANON_KEY")))
        print("KEY PREFIX:", key[:20] if key else None)
        if not url or not key:
            raise RuntimeError("SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env")
        _client = create_client(url, key)
    return _client
