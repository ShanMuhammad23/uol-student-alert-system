set -euo pipefail                                                                                                                                                                                   
APP_DIR="/root/uol-student-alert-system" # <-- change if different                                                                                                                                  
APP_BASE_URL="http://127.0.0.1:3002" # your live app port                                                                                                                                           
SQL_FILE="$APP_DIR/scripts/alert-counts-upsert.sql"                                                                                                                                                 
LOG_FILE="/var/log/uol-alert-counts.log"                                                                                                                                                            
export PATH="/usr/local/bin:/usr/bin:/bin"                                                                                                                                                          
export APP_BASE_URL                                                                                                                                                                                 
# DB connection (choose one method)                                                                                                                                                                 
export DATABASE_URL="postgresql://postgres:shan237426@127.0.0.1:5432/student_alert_system"                                                                                                          
cd "$APP_DIR"                                                                                                                                                                                       
{                                                                                                                                                                                                   
echo "[$(date '+%F %T')]                                                                                                                                                                            
Start"                                                                                                                                                                                              
npm run build:alert-counts-sql                                                                                                                                                                      
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$SQL_FILE"                                                                                                                                              
echo "[$(date '+%F %T')] Done"                                                                                                                                                                      
} >> "$LOG_FILE" 2>&1  