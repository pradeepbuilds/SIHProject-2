class BlockReplicationBaseline:
    def __init__(self):
        self.model_version_id = 'v0.1-baseline-block-replication'
        self.model_type = 'baseline_block_replication'
        
    def fit(self, X, y=None):
        pass # No training required
        
    def predict(self, X, variable):
        """
        X must be a pandas DataFrame containing the coarse forecast for the variable.
        """
        if variable == 'temp_max':
            col = 'coarse_temp_max_c'
        elif variable == 'temp_min':
            col = 'coarse_temp_min_c'
        elif variable == 'rainfall':
            col = 'coarse_rainfall_mm'
        elif variable == 'humidity':
            col = 'coarse_humidity_pct'
        else:
            raise ValueError(f"Unknown variable {variable}")
            
        if col not in X.columns:
            raise KeyError(f"Missing coarse variable column {col} in input features")
            
        return X[col].values
