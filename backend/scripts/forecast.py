import sys
import json
import os
try:
    import pandas as pd
    from pymongo import MongoClient
    from sklearn.ensemble import RandomForestRegressor
    import numpy as np
    from datetime import datetime, timedelta
    from bson import ObjectId
    import math
except ImportError as e:
    import sys
    print(f"Missing dependency: {str(e)}", file=sys.stderr)
    print(json.dumps({"status": "error", "message": f"Python dependencies missing: {str(e)}"}))
    sys.exit(1)

import warnings
warnings.filterwarnings("ignore")

def run_forecast(product_id_str):
    try:
        # DB connection
        mongo_uri = os.environ.get("MONGODB_URI")
        
        # Fallback for local testing if needed, but primary source should be env
        if not mongo_uri:
            mongo_uri = "mongodb+srv://rexxyaloconar_db_user:fU8NxUjFVUWAZNBs@fabriq.kmjnhhn.mongodb.net/FabrIQ"
            
        client = MongoClient(mongo_uri)
        
        # Try to get DB name from URI, fallback to 'FabrIQ'
        try:
            db = client.get_default_database()
        except:
            db = client["FabrIQ"]
            
        orders_col = db["orders"]

        # Ensure valid ObjectId
        try:
            p_id = ObjectId(product_id_str)
        except:
            return {"status": "error", "message": "Invalid Product ID format"}

        # Aggregation pipeline
        pipeline = [
            {"$unwind": "$items"},
            {"$match": {"items.productId": p_id, "status": {"$ne": "Canceled"}}},
            {"$project": {
                "date": "$createdAt",
                "quantity": "$items.quantity"
            }}
        ]

        data = list(orders_col.aggregate(pipeline))

        if not data:
            return {
                "product_id": product_id_str,
                "predictions": [0, 0, 0, 0],
                "status": "success",
                "message": "No sales data found for this product"
            }

        # Process with Pandas
        df = pd.DataFrame(data)
        df['date'] = pd.to_datetime(df['date'])
        
        # Resample to weekly totals
        # We use reset_index to keep the 'date' as a column for feature extraction
        weekly_sales = df.resample('W', on='date')['quantity'].sum().reset_index().fillna(0)

        # Feature Engineering: Adding Seasonality
        # 1. Week Index (Overall Trend)
        weekly_sales['week_index'] = np.arange(len(weekly_sales))
        # 2. Month (Seasonality)
        weekly_sales['month'] = weekly_sales['date'].dt.month
        # 3. Week of Year (Granular Seasonality)
        weekly_sales['week_of_year'] = weekly_sales['date'].dt.isocalendar().week.astype(int)

        # Check data points
        if len(weekly_sales) < 5:
            # Fallback to simple average if too few points for multi-feature RF
            avg_val = float(weekly_sales['quantity'].mean()) if not weekly_sales.empty else 0
            return {
                "product_id": product_id_str,
                "predictions": [round(avg_val, 2)] * 4,
                "status": "success",
                "message": "Insufficient data for seasonal ML model; returned average"
            }

        # ML Training: Random Forest with Seasonality Features
        features = ['week_index', 'month', 'week_of_year']
        X = weekly_sales[features].values
        y = weekly_sales['quantity'].values

        model = RandomForestRegressor(n_estimators=100, random_state=42)
        model.fit(X, y)

        # Generate features for the next 4 weeks
        last_date = weekly_sales['date'].max()
        future_dates = [last_date + timedelta(weeks=i+1) for i in range(4)]
        
        future_df = pd.DataFrame({'date': future_dates})
        future_df['week_index'] = np.arange(len(weekly_sales), len(weekly_sales) + 4)
        future_df['month'] = future_df['date'].dt.month
        future_df['week_of_year'] = future_df['date'].dt.isocalendar().week.astype(int)

        # Predict based on Trend + Month + Week of Year
        forecast = model.predict(future_df[features].values)

        return {
            "product_id": product_id_str,
            "predictions": [int(math.ceil(float(p))) for p in forecast],
            "status": "success",
            "metadata": {
                "model_type": "Random Forest (Seasonal)",
                "features_used": features,
                "data_points": len(weekly_sales)
            }
        }

    except Exception as e:
        import traceback
        error_msg = f"Forecasting Exception: {str(e)}\n{traceback.format_exc()}"
        print(error_msg, file=sys.stderr)
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"status": "error", "message": "Missing product_id argument"}))
        sys.exit(1)
    
    result = run_forecast(sys.argv[1])
    print(json.dumps(result))
