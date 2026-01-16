#!/bin/bash
# URL="https://work.moecapital.com/api/telegram/webhook"
URL="https://work.moecapital.com/api/telegram/webhook"

echo "Testing Content Refinery pipeline..."
echo "Target: $URL"

echo "Registering Admin User (Mock)..."
curl -s -X POST -H "Content-Type: application/json" -d '{"chatId": 123456, "username": "testadmin", "firstName": "Test"}' "https://work.moecapital.com/api/admin/register"
echo ""

echo "Test: Multi-Source Consolidation & Urgency..."
# Send same news from two channels
COMMON_NEWS="BREAKING: Central Bank of Kenya announces rate hike to 13.0% from 12.5%. #CBK #Kenya"

echo "Channel 1: Americamoe (Urgency High)..."
curl -s -X POST -H "Content-Type: application/json" -d "{
    \"update_id\": 5001,
    \"channel_post\": {
        \"message_id\": 6001,
        \"chat\": { \"id\": 101, \"title\": \"Americamoe\", \"type\": \"channel\" },
        \"date\": $(date +%s),
        \"text\": \"$COMMON_NEWS. High importance for market stability.\"
    }
}" "$URL"

echo "Channel 2: MoneyAcademyKE (Urgency High)..."
curl -s -X POST -H "Content-Type: application/json" -d "{
    \"update_id\": 5002,
    \"channel_post\": {
        \"message_id\": 6002,
        \"chat\": { \"id\": 102, \"title\": \"MoneyAcademyKE\", \"type\": \"channel\" },
        \"date\": $(date +%s),
        \"text\": \"$COMMON_NEWS. Verified by analyst team.\"
    }
}" "$URL"

curl -s -X POST "https://work.moecapital.com/api/refinery/process"

echo "Verification Complete. Run logs check:"
echo "1. Boards: curl -s -X POST -H 'Content-Type: application/json' -d '{\"sql\": \"SELECT id, title FROM boards\"}' https://work.moecapital.com/api/sql"
echo "2. Cards Routing: curl -s -X POST -H 'Content-Type: application/json' -d '{\"sql\": \"SELECT title, board_id FROM cards WHERE title LIKE \u0027%Intel%\u0027\"}' https://work.moecapital.com/api/sql"
