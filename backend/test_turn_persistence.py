"""The forced persistence failure seam stays tested after the DB triggers were removed."""
import unittest

from test_harness import ForcedPersistenceError, force_failure, forced_failure, maybe_fail


class ForcedFailureTests(unittest.TestCase):
    def test_no_forced_role_is_a_noop(self) -> None:
        self.assertFalse(forced_failure("user"))
        self.assertFalse(forced_failure("assistant"))
        maybe_fail("user")
        maybe_fail("assistant")

    def test_user_failure_is_forced_and_restored(self) -> None:
        with force_failure("user"):
            self.assertTrue(forced_failure("user"))
            self.assertFalse(forced_failure("assistant"))
            with self.assertRaises(ForcedPersistenceError):
                maybe_fail("user")
            maybe_fail("assistant")
        self.assertFalse(forced_failure("user"))

    def test_assistant_failure_is_forced_and_restored(self) -> None:
        with force_failure("assistant"):
            self.assertTrue(forced_failure("assistant"))
            self.assertFalse(forced_failure("user"))
            with self.assertRaises(ForcedPersistenceError):
                maybe_fail("assistant")
            maybe_fail("user")
        self.assertFalse(forced_failure("assistant"))


if __name__ == "__main__":
    unittest.main()
