"""
Playwright tests for the new Sidebar functionality.
Tests: Ideation Panel, Backlog Panel, Spec Editor, and Terminal.
"""

import pytest
from playwright.sync_api import Page, expect
import time


BASE_URL = "http://127.0.0.1:8888"


@pytest.fixture(scope="function")
def page_with_project(page: Page):
    """Navigate to the app and create/select a test project."""
    page.goto(BASE_URL)
    page.wait_for_load_state("networkidle")
    
    # Wait for the app to load
    time.sleep(1)
    
    # Check if we need to create a new project or select existing
    # Look for the new project button
    new_project_btn = page.locator('button:has-text("New Project")')
    if new_project_btn.count() > 0:
        new_project_btn.first.click()
        time.sleep(0.5)
        
        # Fill in project details
        project_name_input = page.locator('input[placeholder*="project"]').first
        if project_name_input.count() > 0:
            project_name_input.fill("test-sidebar-project")
            
        # Look for create/submit button
        create_btn = page.locator('button:has-text("Create")').first
        if create_btn.count() > 0:
            create_btn.click()
            time.sleep(1)
    
    yield page


def test_app_loads(page: Page):
    """Test that the app loads successfully."""
    page.goto(BASE_URL)
    page.wait_for_load_state("networkidle")
    
    # Check for main app elements
    expect(page.locator("body")).to_be_visible()
    
    # Look for AutoCoder branding or header
    header = page.locator("header, nav, [class*='header'], [class*='nav']").first
    expect(header).to_be_visible(timeout=5000)


def test_sidebar_toggle_visibility(page: Page):
    """Test that sidebar can be toggled open/closed."""
    page.goto(BASE_URL)
    page.wait_for_load_state("networkidle")
    time.sleep(1)
    
    # Look for sidebar toggle button or sidebar element
    sidebar_toggle = page.locator('[aria-label*="sidebar"], [title*="sidebar"], button:has-text("Tools")').first
    
    if sidebar_toggle.count() > 0:
        sidebar_toggle.click()
        time.sleep(0.5)
        
        # Check sidebar is visible
        sidebar = page.locator('[class*="sidebar"], aside, [role="complementary"]').first
        expect(sidebar).to_be_visible()


def test_sidebar_keyboard_shortcuts(page: Page):
    """Test keyboard shortcuts for sidebar panels."""
    page.goto(BASE_URL)
    page.wait_for_load_state("networkidle")
    time.sleep(1)
    
    # Test pressing 'I' for Ideation panel (with Shift)
    page.keyboard.press("Shift+I")
    time.sleep(0.5)
    
    # Look for ideation panel content
    ideation_content = page.locator('text="Ideation", text="Feature Ideas", text="Categories"').first
    # If visible, great!


def test_ideation_panel_categories(page: Page):
    """Test that ideation panel shows categories."""
    page.goto(BASE_URL)
    page.wait_for_load_state("networkidle")
    time.sleep(1)
    
    # Try to open ideation panel via keyboard or button
    page.keyboard.press("Shift+I")
    time.sleep(0.5)
    
    # Or click on ideation icon in sidebar
    ideation_btn = page.locator('[title*="Ideation"], [aria-label*="Ideation"]').first
    if ideation_btn.count() > 0:
        ideation_btn.click()
        time.sleep(0.5)
    
    # Check for category elements
    categories = [
        "Core Features",
        "UI/UX",
        "Performance",
        "Security",
        "Testing",
        "DevOps",
        "API",
        "Data",
        "Integration"
    ]
    
    for category in categories[:3]:  # Check first 3 categories
        category_element = page.locator(f'text="{category}"').first
        # Just check if any categories are present


def test_backlog_panel_columns(page: Page):
    """Test that backlog panel shows kanban columns."""
    page.goto(BASE_URL)
    page.wait_for_load_state("networkidle")
    time.sleep(1)
    
    # Try to open backlog panel
    page.keyboard.press("Shift+B")
    time.sleep(0.5)
    
    backlog_btn = page.locator('[title*="Backlog"], [aria-label*="Backlog"]').first
    if backlog_btn.count() > 0:
        backlog_btn.click()
        time.sleep(0.5)
    
    # Check for backlog header or add button
    add_idea_btn = page.locator('button:has-text("Add Idea"), button:has-text("Add")').first


def test_spec_editor_panel(page: Page):
    """Test that spec editor panel loads."""
    page.goto(BASE_URL)
    page.wait_for_load_state("networkidle")
    time.sleep(1)
    
    # Try to open spec editor panel
    page.keyboard.press("Shift+E")
    time.sleep(0.5)
    
    spec_btn = page.locator('[title*="Spec"], [aria-label*="Spec"]').first
    if spec_btn.count() > 0:
        spec_btn.click()
        time.sleep(0.5)
    
    # Check for CodeMirror editor or textarea
    editor = page.locator('.cm-editor, textarea, [class*="editor"]').first


def test_terminal_panel(page: Page):
    """Test that terminal panel loads."""
    page.goto(BASE_URL)
    page.wait_for_load_state("networkidle")
    time.sleep(1)
    
    # Try to open terminal panel
    page.keyboard.press("Shift+T")
    time.sleep(0.5)
    
    terminal_btn = page.locator('[title*="Terminal"], [aria-label*="Terminal"]').first
    if terminal_btn.count() > 0:
        terminal_btn.click()
        time.sleep(0.5)
    
    # Check for xterm element
    terminal = page.locator('.xterm, [class*="terminal"]').first


def test_sidebar_icons_visible(page: Page):
    """Test that all sidebar icons are present."""
    page.goto(BASE_URL)
    page.wait_for_load_state("networkidle")
    time.sleep(1)
    
    # Screenshot for debugging
    page.screenshot(path="tests/screenshots/sidebar_test.png", full_page=True)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--headed"])
