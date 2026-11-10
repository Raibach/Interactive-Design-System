"""The console tool inventory is the registry, not a hardcoded button list."""
import unittest

from console_tools import (
    CONSOLE_TOOLS,
    EXPECTED_TOOL_COUNT,
    available_tool,
    resolve_tool_selection,
    tool_inventory,
)


class ToolInventoryTests(unittest.TestCase):
    def test_figma_is_available(self) -> None:
        inventory = tool_inventory()
        figma = next(tool for tool in inventory if tool["token"] == "figma-ingest")
        self.assertEqual(figma["label"], "Figma ingest")
        self.assertEqual(figma["status"], "available")
        self.assertTrue(figma["entry"])
        self.assertIsNotNone(available_tool("figma-ingest"))

    def test_unknown_or_unavailable_is_refused(self) -> None:
        self.assertIsNone(available_tool("not-a-tool"))
        CONSOLE_TOOLS["planned-test"] = {
            "label": "Planned", "description": "", "status": "not built", "entry": "",
        }
        try:
            self.assertIsNone(available_tool("planned-test"))
        finally:
            CONSOLE_TOOLS.pop("planned-test", None)

    def test_expected_size_is_declared(self) -> None:
        self.assertEqual(EXPECTED_TOOL_COUNT, 15)

    def test_selection_by_name_and_description(self) -> None:
        by_name = resolve_tool_selection("Figma ingest")
        self.assertEqual(by_name["status"], "available")
        self.assertEqual(by_name["tool"]["token"], "figma-ingest")
        by_description = resolve_tool_selection("the Figma frame in tool")
        self.assertEqual(by_description["status"], "available")
        self.assertEqual(by_description["tool"]["token"], "figma-ingest")

    def test_unbuilt_selection_is_refused_in_words(self) -> None:
        CONSOLE_TOOLS["planned-test"] = {
            "label": "Planned", "description": "a plan", "status": "not built", "entry": "",
        }
        try:
            result = resolve_tool_selection("Planned")
            self.assertEqual(result["status"], "refused")
            self.assertIn("not built yet", result["reason"])
            self.assertIsNone(result["tool"])
        finally:
            CONSOLE_TOOLS.pop("planned-test", None)

    def test_unknown_selection_names_only_real_available_tools(self) -> None:
        result = resolve_tool_selection("the flow mapper")
        self.assertEqual(result["status"], "refused")
        self.assertIsNone(result["tool"])
        self.assertIn("Figma ingest", result["reason"])
        self.assertNotIn("Flow mapper", result["reason"])


if __name__ == "__main__":
    unittest.main()
