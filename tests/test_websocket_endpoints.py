"""
WebSocket Endpoint Tests
========================

Tests to verify WebSocket endpoints accept connections properly.
"""

import asyncio
import pytest
import websockets
from websockets.exceptions import ConnectionClosed


# Test configuration
BASE_URL = "ws://localhost:8888"
TEST_PROJECT = "testing4"


@pytest.fixture
def event_loop():
    """Create an instance of the event loop for tests."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


class TestSpecWebSocket:
    """Tests for /api/spec/ws/{project_name} endpoint."""
    
    @pytest.mark.asyncio
    async def test_spec_websocket_connects(self):
        """Test that spec WebSocket accepts connection."""
        uri = f"{BASE_URL}/api/spec/ws/{TEST_PROJECT}"
        async with websockets.connect(uri) as ws:
            assert ws.open
            # Send ping
            await ws.send('{"type": "ping"}')
            response = await asyncio.wait_for(ws.recv(), timeout=5)
            assert '"type":"pong"' in response or '"type": "pong"' in response
    
    @pytest.mark.asyncio
    async def test_spec_websocket_invalid_project(self):
        """Test that spec WebSocket handles invalid project name gracefully."""
        uri = f"{BASE_URL}/api/spec/ws/invalid..project"
        async with websockets.connect(uri) as ws:
            # Should connect first, then send error
            response = await asyncio.wait_for(ws.recv(), timeout=5)
            assert "error" in response


class TestProjectWebSocket:
    """Tests for /ws/projects/{project_name} endpoint."""
    
    @pytest.mark.asyncio
    async def test_project_websocket_connects(self):
        """Test that project WebSocket accepts connection."""
        uri = f"{BASE_URL}/ws/projects/{TEST_PROJECT}"
        async with websockets.connect(uri) as ws:
            assert ws.open
            # Should receive progress update
            response = await asyncio.wait_for(ws.recv(), timeout=5)
            assert "progress" in response or "agent_status" in response
    
    @pytest.mark.asyncio
    async def test_project_websocket_invalid_project(self):
        """Test that project WebSocket handles invalid project gracefully."""
        uri = f"{BASE_URL}/ws/projects/nonexistent_project_xyz"
        async with websockets.connect(uri) as ws:
            # Should connect first, then send error
            response = await asyncio.wait_for(ws.recv(), timeout=5)
            assert "error" in response


class TestAssistantWebSocket:
    """Tests for /api/assistant/ws/{project_name} endpoint."""
    
    @pytest.mark.asyncio
    async def test_assistant_websocket_connects(self):
        """Test that assistant WebSocket accepts connection."""
        uri = f"{BASE_URL}/api/assistant/ws/{TEST_PROJECT}"
        async with websockets.connect(uri) as ws:
            assert ws.open
            # Send ping
            await ws.send('{"type": "ping"}')
            response = await asyncio.wait_for(ws.recv(), timeout=5)
            assert '"type":"pong"' in response or '"type": "pong"' in response
    
    @pytest.mark.asyncio
    async def test_assistant_websocket_invalid_project(self):
        """Test that assistant WebSocket handles invalid project gracefully."""
        uri = f"{BASE_URL}/api/assistant/ws/invalid..project"
        async with websockets.connect(uri) as ws:
            # Should connect first, then send error
            response = await asyncio.wait_for(ws.recv(), timeout=5)
            assert "error" in response


if __name__ == "__main__":
    """Run tests directly."""
    import sys
    
    async def run_tests():
        print("Testing WebSocket endpoints...")
        print(f"Base URL: {BASE_URL}")
        print(f"Test project: {TEST_PROJECT}")
        print()
        
        # Test 1: Spec WebSocket
        print("1. Testing /api/spec/ws/{project_name}...")
        try:
            uri = f"{BASE_URL}/api/spec/ws/{TEST_PROJECT}"
            async with websockets.connect(uri) as ws:
                await ws.send('{"type": "ping"}')
                response = await asyncio.wait_for(ws.recv(), timeout=5)
                if "pong" in response:
                    print("   ✓ Spec WebSocket works!")
                else:
                    print(f"   ✗ Unexpected response: {response}")
        except Exception as e:
            print(f"   ✗ Failed: {e}")
        
        # Test 2: Project WebSocket
        print("2. Testing /ws/projects/{project_name}...")
        try:
            uri = f"{BASE_URL}/ws/projects/{TEST_PROJECT}"
            async with websockets.connect(uri) as ws:
                response = await asyncio.wait_for(ws.recv(), timeout=5)
                if "progress" in response or "agent_status" in response:
                    print("   ✓ Project WebSocket works!")
                else:
                    print(f"   ✗ Unexpected response: {response}")
        except Exception as e:
            print(f"   ✗ Failed: {e}")
        
        # Test 3: Assistant WebSocket
        print("3. Testing /api/assistant/ws/{project_name}...")
        try:
            uri = f"{BASE_URL}/api/assistant/ws/{TEST_PROJECT}"
            async with websockets.connect(uri) as ws:
                await ws.send('{"type": "ping"}')
                response = await asyncio.wait_for(ws.recv(), timeout=5)
                if "pong" in response:
                    print("   ✓ Assistant WebSocket works!")
                else:
                    print(f"   ✗ Unexpected response: {response}")
        except Exception as e:
            print(f"   ✗ Failed: {e}")
        
        print()
        print("Done!")
    
    asyncio.run(run_tests())
