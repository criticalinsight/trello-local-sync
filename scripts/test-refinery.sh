#!/bin/bash
# URL="https://work.moecapital.com/api/telegram/webhook"
URL="https://work.moecapital.com/api/telegram/webhook"

echo "Testing Content Refinery pipeline..."
echo "Target: $URL"

echo "Registering Admin User (Mock)..."
curl -s -X POST -H "Content-Type: application/json" -d '{"chatId": 123456, "username": "testadmin", "firstName": "Test"}' "https://work.moecapital.com/api/admin/register"
echo ""

# Send 12 messages to trigger batch processing (Batch size is 10)
for i in {1..12}
do
   PAYLOAD=$(cat <<EOF
{
    "update_id": $((1000 + i)),
    "channel_post": {
        "message_id": $((2000 + i)),
        "chat": {
            "id": -100123456789,
            "title": "Test Financial Channel",
            "type": "channel"
        },
        "date": $(date +%s),
        "text": "BREAKING: Tesla ($TSLA) reports record earnings for Q4. Revenue up 20%. #earnings #tech (Message $i)"
    }
}
EOF
)

   echo "Sending message $i..."
   curl -s -X POST -H "Content-Type: application/json" -d "$PAYLOAD" "$URL"
   echo ""
done

echo "Triggering manual batch processing..."
curl -s -X POST "https://work.moecapital.com/api/refinery/process"
echo ""

echo "Test: Deduplication (Sending same message again)..."
curl -s -X POST -H "Content-Type: application/json" -d "$PAYLOAD" "$URL"
curl -s -X POST "https://work.moecapital.com/api/refinery/process"
echo "Check logs: should see 'Duplicate signal detected'"

echo "Test: RSS Ingestion..."
curl -s -X POST -H "Content-Type: application/json" -d '{"url": "https://feeds.bloomberg.com/markets/news.rss"}' "https://work.moecapital.com/api/refinery/rss"
echo ""

echo "Test: Daily Briefing Synthesis..."
curl -s -X POST "https://work.moecapital.com/api/scheduler/tick"
echo ""

echo "Verification Complete. Run logs check:"
echo "1. Activity: curl -s https://work.moecapital.com/api/logs"
echo "2. Entities: curl -s -X POST -H 'Content-Type: application/json' -d '{\"sql\": \"SELECT * FROM entities\"}' https://work.moecapital.com/api/sql"
echo "3. Signals: curl -s -X POST -H 'Content-Type: application/json' -d '{\"sql\": \"SELECT * FROM signals\"}' https://work.moecapital.com/api/sql"
echo "4. Boards: curl -s -X POST -H 'Content-Type: application/json' -d '{\"sql\": \"SELECT * FROM boards\"}' https://work.moecapital.com/api/sql"
echo "5. Cards & Boards: curl -s -X POST -H 'Content-Type: application/json' -d '{\"sql\": \"SELECT title, board_id, list_id FROM cards\"}' https://work.moecapital.com/api/sql"
