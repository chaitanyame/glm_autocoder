"""
Database Models and Connection
==============================

SQLite database schema for feature storage using SQLAlchemy.
"""

from pathlib import Path
from typing import Optional

from sqlalchemy import Boolean, Column, Integer, String, Text, create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.types import JSON

Base = declarative_base()

# Name of the operational folder for AutoCoder files
AUTOCODER_DIR_NAME = ".autocoder"


def get_autocoder_dir(project_dir: Path) -> Path:
    """
    Get or create the .autocoder operational directory.
    
    This directory contains all AutoCoder operational files:
    - features.db (feature database)
    - .agent.lock (agent lock file)
    - logs/ (session logs, progress files)
    - tests/ (test scripts, verification files)
    - temp/ (temporary files, test data)
    - reports/ (generated reports)
    
    Keeping these in a dedicated folder keeps the project root clean.
    """
    autocoder_dir = project_dir / AUTOCODER_DIR_NAME
    autocoder_dir.mkdir(parents=True, exist_ok=True)
    return autocoder_dir


class Feature(Base):
    """Feature model representing a test case/feature to implement."""

    __tablename__ = "features"

    id = Column(Integer, primary_key=True, index=True)
    priority = Column(Integer, nullable=False, default=999, index=True)
    category = Column(String(100), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    steps = Column(JSON, nullable=False)  # Stored as JSON array
    passes = Column(Boolean, default=False, index=True)
    in_progress = Column(Boolean, default=False, index=True)

    def to_dict(self) -> dict:
        """Convert feature to dictionary for JSON serialization."""
        return {
            "id": self.id,
            "priority": self.priority,
            "category": self.category,
            "name": self.name,
            "description": self.description,
            "steps": self.steps,
            "passes": self.passes,
            "in_progress": self.in_progress,
        }


def get_database_path(project_dir: Path) -> Path:
    """
    Return the path to the SQLite database for a project.
    
    The database is stored in .autocoder/ to keep the project root clean.
    For backward compatibility, if features.db exists in the root, it will
    be migrated to .autocoder/ on first access.
    """
    autocoder_dir = get_autocoder_dir(project_dir)
    new_db_path = autocoder_dir / "features.db"
    legacy_db_path = project_dir / "features.db"
    
    # Migrate legacy database if it exists and new location doesn't
    if legacy_db_path.exists() and not new_db_path.exists():
        import shutil
        shutil.move(str(legacy_db_path), str(new_db_path))
    
    return new_db_path


def get_lock_file_path(project_dir: Path) -> Path:
    """
    Return the path to the agent lock file.
    
    The lock file is stored in .autocoder/ to keep the project root clean.
    For backward compatibility, if .agent.lock exists in the root, it will
    be migrated to .autocoder/ on first access.
    """
    autocoder_dir = get_autocoder_dir(project_dir)
    new_lock_path = autocoder_dir / ".agent.lock"
    legacy_lock_path = project_dir / ".agent.lock"
    
    # Migrate legacy lock file if it exists and new location doesn't
    if legacy_lock_path.exists() and not new_lock_path.exists():
        import shutil
        shutil.move(str(legacy_lock_path), str(new_lock_path))
    elif legacy_lock_path.exists() and new_lock_path.exists():
        # Both exist - remove the legacy one
        legacy_lock_path.unlink()
    
    return new_lock_path


def get_database_url(project_dir: Path) -> str:
    """Return the SQLAlchemy database URL for a project.

    Uses POSIX-style paths (forward slashes) for cross-platform compatibility.
    """
    db_path = get_database_path(project_dir)
    return f"sqlite:///{db_path.as_posix()}"


def _migrate_add_in_progress_column(engine) -> None:
    """Add in_progress column to existing databases that don't have it."""
    from sqlalchemy import text

    with engine.connect() as conn:
        # Check if column exists
        result = conn.execute(text("PRAGMA table_info(features)"))
        columns = [row[1] for row in result.fetchall()]

        if "in_progress" not in columns:
            # Add the column with default value
            conn.execute(text("ALTER TABLE features ADD COLUMN in_progress BOOLEAN DEFAULT 0"))
            conn.commit()


def create_database(project_dir: Path) -> tuple:
    """
    Create database and return engine + session maker.

    Args:
        project_dir: Directory containing the project

    Returns:
        Tuple of (engine, SessionLocal)
    """
    db_url = get_database_url(project_dir)
    engine = create_engine(db_url, connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)

    # Migrate existing databases to add in_progress column
    _migrate_add_in_progress_column(engine)

    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    return engine, SessionLocal


# Global session maker - will be set when server starts
_session_maker: Optional[sessionmaker] = None


def set_session_maker(session_maker: sessionmaker) -> None:
    """Set the global session maker."""
    global _session_maker
    _session_maker = session_maker


def get_db() -> Session:
    """
    Dependency for FastAPI to get database session.

    Yields a database session and ensures it's closed after use.
    """
    if _session_maker is None:
        raise RuntimeError("Database not initialized. Call set_session_maker first.")

    db = _session_maker()
    try:
        yield db
    finally:
        db.close()
