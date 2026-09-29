// KrishiMitra Accessible Color Scales (from tokens.css)
export const RAIN_SCALE = ['#F7FBFF', '#C6DBEF', '#6BAED6', '#2171B5', '#08306B'];
export const HEAT_SCALE = ['#FFFFB2', '#FECC5C', '#FD8D3C', '#F03B20', '#BD0026'];
export const TEMP_MIN_SCALE = ['#E0F3F8', '#ABD9E9', '#74ADD1', '#4575B4', '#313695'];
export const DIV_SCALE = {
  neg_strong: '#2166AC',
  neg_mild: '#67A9CF',
  mid: '#F7F7F7',
  pos_mild: '#EF8A62',
  pos_strong: '#B2182B'
};

export function getColorForValue(val: number, variable: string, mode: 'coarse' | 'downscaled' | 'difference' = 'downscaled'): string {
  if (mode === 'difference') {
    // Diverging scale around 0
    if (val <= -5.0) return DIV_SCALE.neg_strong;
    if (val <= -1.0) return DIV_SCALE.neg_mild;
    if (val < 1.0) return DIV_SCALE.mid;
    if (val < 5.0) return DIV_SCALE.pos_mild;
    return DIV_SCALE.pos_strong;
  }

  const normVar = variable.toLowerCase();

  if (normVar.includes('rain')) {
    // Rainfall Scale (mm)
    if (val <= 0.2) return RAIN_SCALE[0];
    if (val <= 5.0) return RAIN_SCALE[1];
    if (val <= 20.0) return RAIN_SCALE[2];
    if (val <= 45.0) return RAIN_SCALE[3];
    return RAIN_SCALE[4];
  } else if (normVar.includes('min')) {
    // Minimum Temperature (°C)
    if (val <= 12.0) return TEMP_MIN_SCALE[4];
    if (val <= 16.0) return TEMP_MIN_SCALE[3];
    if (val <= 20.0) return TEMP_MIN_SCALE[2];
    if (val <= 24.0) return TEMP_MIN_SCALE[1];
    return TEMP_MIN_SCALE[0];
  } else {
    // Maximum Temperature (°C)
    if (val <= 26.0) return HEAT_SCALE[0];
    if (val <= 30.0) return HEAT_SCALE[1];
    if (val <= 34.0) return HEAT_SCALE[2];
    if (val <= 38.0) return HEAT_SCALE[3];
    return HEAT_SCALE[4];
  }
}

export function getLegendStops(variable: string, mode: 'coarse' | 'downscaled' | 'difference' = 'downscaled'): { color: string; label: string }[] {
  if (mode === 'difference') {
    return [
      { color: DIV_SCALE.neg_strong, label: '≤ -5' },
      { color: DIV_SCALE.neg_mild, label: '-2' },
      { color: DIV_SCALE.mid, label: '0' },
      { color: DIV_SCALE.pos_mild, label: '+2' },
      { color: DIV_SCALE.pos_strong, label: '≥ +5' }
    ];
  }

  const normVar = variable.toLowerCase();
  if (normVar.includes('rain')) {
    return [
      { color: RAIN_SCALE[0], label: '0 mm' },
      { color: RAIN_SCALE[1], label: '5 mm' },
      { color: RAIN_SCALE[2], label: '20 mm' },
      { color: RAIN_SCALE[3], label: '45 mm' },
      { color: RAIN_SCALE[4], label: '60+ mm' }
    ];
  } else if (normVar.includes('min')) {
    return [
      { color: TEMP_MIN_SCALE[0], label: '> 24°C' },
      { color: TEMP_MIN_SCALE[1], label: '20°C' },
      { color: TEMP_MIN_SCALE[2], label: '16°C' },
      { color: TEMP_MIN_SCALE[4], label: '< 12°C' }
    ];
  } else {
    return [
      { color: HEAT_SCALE[0], label: '< 26°C' },
      { color: HEAT_SCALE[1], label: '30°C' },
      { color: HEAT_SCALE[2], label: '34°C' },
      { color: HEAT_SCALE[3], label: '38°C' },
      { color: HEAT_SCALE[4], label: '40°C+' }
    ];
  }
}
