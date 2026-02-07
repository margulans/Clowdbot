#!/bin/bash
# News Digest Generator for Margulan
# Collects news from all configured sources and generates digest

set -e

WORKSPACE_DIR="/home/openclaw/.openclaw/workspace"
NEWS_DIR="$WORKSPACE_DIR/news-cache"
TODAY=$(date +%Y-%m-%d)
DIGEST_TIME=$(date +%H:%M)

# Create news cache directory
mkdir -p "$NEWS_DIR"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$NEWS_DIR/collector.log"
}

log "Starting news collection - $DIGEST_TIME digest"

# Function to collect from web sources
collect_web_news() {
    log "Collecting from web sources..."
    
    # Key sources for Margulan's interests
    sources=(
        "https://techcrunch.com"
        "https://www.technologyreview.com" 
        "https://evtol.com"
        "https://www.producthunt.com"
        "https://spectrum.ieee.org/robotics"
        "https://openai.com/blog"
    )
    
    for source in "${sources[@]}"; do
        domain=$(echo "$source" | cut -d'/' -f3)
        cache_file="$NEWS_DIR/${domain}_${TODAY}.json"
        
        if [ ! -f "$cache_file" ]; then
            log "Fetching from $domain"
            # This would be replaced with actual web scraping
            echo "{\"source\": \"$domain\", \"articles\": [], \"updated\": \"$(date -Iseconds)\"}" > "$cache_file"
        fi
    done
}

# Function to score and filter news with 33% exploration rule
filter_relevant_news() {
    log "Filtering news with 33% exploration rule..."
    
    # Use the enhanced news aggregator
    node "$WORKSPACE_DIR/news-aggregator.js" filter "$NEWS_DIR" > "$NEWS_DIR/temp_filtered.json"
    
    # Apply exploration rule (33% new sources)
    filtered_file="$NEWS_DIR/filtered_${TODAY}_${DIGEST_TIME}.json"
    node -e "
        const { applyExplorationRule } = require('$WORKSPACE_DIR/news-aggregator.js');
        const fs = require('fs');
        
        try {
            const tempData = JSON.parse(fs.readFileSync('$NEWS_DIR/temp_filtered.json'));
            const explorationFiltered = applyExplorationRule(tempData.articles || []);
            
            const result = {
                digest_time: '$DIGEST_TIME',
                total_articles: explorationFiltered.length,
                proven_sources: explorationFiltered.filter(a => a.source_category === 'proven').length,
                exploration_sources: explorationFiltered.filter(a => a.source_category !== 'proven').length,
                exploration_ratio: Math.round((explorationFiltered.filter(a => a.source_category !== 'proven').length / explorationFiltered.length) * 100),
                articles: explorationFiltered
            };
            
            fs.writeFileSync('$filtered_file', JSON.stringify(result, null, 2));
            console.log('✅ Applied 33% exploration rule - ' + result.exploration_ratio + '% new sources');
        } catch (e) {
            console.error('❌ Error applying exploration rule:', e.message);
            fs.writeFileSync('$filtered_file', '{\"articles\": [], \"error\": \"' + e.message + '\"}');
        }
    "
    
    # Cleanup temp file
    rm -f "$NEWS_DIR/temp_filtered.json"
    
    log "✅ Filtered news with exploration rule saved to $filtered_file"
}

# Function to generate digest format
generate_digest() {
    local digest_type=$1
    log "Generating $digest_type digest..."
    
    case $digest_type in
        "morning")
            emoji="🌅"
            title="Утренний Дайджест"
            ;;
        "afternoon") 
            emoji="☀️"
            title="Дневной Дайджест"
            ;;
        "evening")
            emoji="🌆" 
            title="Вечерний Дайджест"
            ;;
        *)
            emoji="📰"
            title="Новостной Дайджест"
            ;;
    esac
    
    digest_file="$NEWS_DIR/digest_${digest_type}_${TODAY}.md"
    
    cat > "$digest_file" << EOF
$emoji **$title** - $(date '+%d.%m.%Y')

## 🤖 Искусственный Интеллект
$(echo "• Пока новостей нет - система настраивается")

## 🦾 Робототехника  
$(echo "• Пока новостей нет - система настраивается")

## ✈️ eVTOL и Дроны
$(echo "• Пока новостей нет - система настраивается") 

## 💼 Бизнес и Стартапы
$(echo "• Пока новостей нет - система настраивается")

## 🛠 Инструменты и Лайфхаки
$(echo "• Пока новостей нет - система настраивается")

---
_Новостной агрегатор Нейрон 🧠_
EOF
    
    log "Digest generated: $digest_file"
    echo "$digest_file"
}

# Main execution
main() {
    collect_web_news
    filter_relevant_news
    
    # Determine digest type based on time
    hour=$(date +%H)
    if [ "$hour" -eq 8 ]; then
        digest_type="morning"
    elif [ "$hour" -eq 13 ]; then
        digest_type="afternoon"  
    elif [ "$hour" -eq 18 ]; then
        digest_type="evening"
    else
        digest_type="manual"
    fi
    
    digest_file=$(generate_digest "$digest_type")
    log "News digest complete: $digest_file"
    
    # Return the digest file path for further processing
    echo "$digest_file"
}

# Execute main function if script is run directly
if [ "${BASH_SOURCE[0]}" == "${0}" ]; then
    main "$@"
fi