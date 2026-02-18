"""Basic tests for the SM-2 implementation.

Run directly: `python backEnd/test_spaced_repetition.py`
"""
from spaced_repetition import sm2_update


def test_sm2_basic():
    card = {"ease_factor": 2.5, "repetitions": 0, "interval_days": 0}
    r1 = sm2_update(card, 5)
    assert r1["repetitions"] == 1
    assert r1["interval_days"] == 1

    # apply and repeat
    card["ease_factor"] = r1["ease_factor"]
    card["repetitions"] = r1["repetitions"]
    card["interval_days"] = r1["interval_days"]

    r2 = sm2_update(card, 5)
    assert r2["repetitions"] == 2
    assert r2["interval_days"] == 6

    card.update(r2)
    r3 = sm2_update(card, 5)
    assert r3["repetitions"] == 3
    assert r3["interval_days"] >= 6


if __name__ == "__main__":
    test_sm2_basic()
    print("sm2 basic tests passed")
