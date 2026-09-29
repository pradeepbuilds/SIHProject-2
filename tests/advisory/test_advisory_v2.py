import pytest
from advisory.rule_engine import rule_engine


def test_hurdle_heavy_rain_threshold_edges():
    """Hurdle heavy rain triggers at p >= 0.5 AND p90 >= 50mm."""
    # Sub-threshold: probability below 0.5
    advs_sub_prob = rule_engine.evaluate(
        rainfall_mm=10.0,
        rain_probability=0.48,
        rainfall_p90_mm=55.0,
        region_thresholds={'heavy_rain_mm': 50.0}
    )
    assert not any(a['rule_id'] == 'heavy_rainfall_v1' for a in advs_sub_prob)

    # Sub-threshold: p90 below 50mm
    advs_sub_p90 = rule_engine.evaluate(
        rainfall_mm=10.0,
        rain_probability=0.65,
        rainfall_p90_mm=48.0,
        region_thresholds={'heavy_rain_mm': 50.0}
    )
    assert not any(a['rule_id'] == 'heavy_rainfall_v1' for a in advs_sub_p90)

    # Exact threshold: probability 0.50 and p90 50.0mm -> triggers warning
    advs_trigger = rule_engine.evaluate(
        rainfall_mm=15.0,
        rain_probability=0.50,
        rainfall_p90_mm=50.0,
        uncertainty_label="low",
        region_thresholds={'heavy_rain_mm': 50.0}
    )
    heavy = next(a for a in advs_trigger if a['rule_id'] == 'heavy_rainfall_v1')
    assert heavy['severity'] == 'warning'
    assert heavy['trigger_inputs']['rain_probability'] == 0.50
    assert heavy['trigger_inputs']['rainfall_p90_mm'] == 50.0


def test_hurdle_irrigation_dry_spell_edges():
    """Hurdle irrigation triggers when rain_prob < 0.2 AND dry_spell >= 5."""
    # Sub-threshold: rain_probability = 0.22 (too wet)
    advs = rule_engine.evaluate(
        rainfall_mm=0.0,
        rain_probability=0.22,
        days_since_last_rain=6,
        region_thresholds={'dry_spell_days': 5}
    )
    assert not any(a['rule_id'] == 'irrigation_suggestion_v1' for a in advs)

    # Sub-threshold: days = 4 (< 5 days)
    advs = rule_engine.evaluate(
        rainfall_mm=0.0,
        rain_probability=0.10,
        days_since_last_rain=4,
        region_thresholds={'dry_spell_days': 5}
    )
    assert not any(a['rule_id'] == 'irrigation_suggestion_v1' for a in advs)

    # At threshold: rain_prob 0.15, days 5 -> triggers info
    advs = rule_engine.evaluate(
        rainfall_mm=0.0,
        rain_probability=0.15,
        days_since_last_rain=5,
        region_thresholds={'dry_spell_days': 5}
    )
    irr = next(a for a in advs if a['rule_id'] == 'irrigation_suggestion_v1')
    assert irr['severity'] == 'info'


def test_cold_snap_threshold_edges():
    """Cold risk triggers at tmin_p50 <= cold_c."""
    # Sub-threshold: 6.5°C (> 6.0°C)
    advs = rule_engine.evaluate(temp_min_c=6.5, tmin_p50=6.5, region_thresholds={'cold_c': 6.0})
    assert not any(a['rule_id'] == 'cold_snap_v1' for a in advs)

    # Triggered: 5.5°C (<= 6.0°C)
    advs = rule_engine.evaluate(temp_min_c=5.5, tmin_p50=5.5, region_thresholds={'cold_c': 6.0})
    cold = next(a for a in advs if a['rule_id'] == 'cold_snap_v1')
    assert cold['severity'] == 'warning'


def test_waterlogging_and_spraying_rules():
    """Test 3-day rain waterlogging and spray avoid window."""
    advs = rule_engine.evaluate(
        rain_3d_sum=75.0,
        rain_probability=0.60
    )
    rule_ids = [a['rule_id'] for a in advs]
    assert 'waterlogging_drainage_v1' in rule_ids
    assert 'spraying_window_v1' in rule_ids


def test_confidence_severity_downgrade():
    """When uncertainty_label == 'high', severity downgrades by one level."""
    # Heavy rain: warning -> watch
    advs_high = rule_engine.evaluate(
        rain_probability=0.8,
        rainfall_p90_mm=60.0,
        uncertainty_label="high",
        region_thresholds={'heavy_rain_mm': 50.0}
    )
    heavy = next(a for a in advs_high if a['rule_id'] == 'heavy_rainfall_v1')
    assert heavy['severity'] == 'watch'
    assert 'uncertain' in heavy['message'].lower()


def test_multilingual_advisory_rendering():
    """Verify Hindi, Kannada, and Marathi translations contain localized strings and disclaimers."""
    for lang in ['hi', 'kn', 'mr']:
        advs = rule_engine.evaluate(
            rain_probability=0.85,
            rainfall_p90_mm=65.0,
            lang=lang,
            uncertainty_label="low"
        )
        assert len(advs) > 0
        heavy = next(a for a in advs if a['rule_id'] == 'heavy_rainfall_v1')
        assert len(heavy['title']) > 0
        assert len(heavy['message']) > 0
        assert len(heavy['disclaimer']) > 0
