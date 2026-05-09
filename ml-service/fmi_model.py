"""
DEPRECATED: fmi_model.py

This module previously contained a rule-based FMI formula. That has been 
replaced with a transparent, mathematically-grounded scoring engine.

See fmi_engine.py for the current FMI implementation.

IMPORTANT:
- FMI is NO LONGER a supervised ML prediction model
- It is now a deterministic financial wellness index based on retirement readiness mathematics
- The scoring is 100% explainable and derived from financial principles, not learned patterns
"""

def compute_fmi(*args, **kwargs):
    raise RuntimeError(
        'Deprecated: FMI calculation has moved to fmi_engine.py\n'
        'Use: from fmi_engine import calculate_fmi\n'
        'Reason: FMI is now a transparent financial scoring engine, not an ML model'
    )
