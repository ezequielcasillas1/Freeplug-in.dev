B=$1
for u in / /es; do t=$(curl -s "$B$u" | sed 's/<[^>]*>/ /g'); echo "== $u $(curl -s -o /dev/null -w %{http_code} $B$u)"
for p in '\$250' '\$450' '\$700' '\$950' '\$1,200' '\$2,000' '16[–-]25' '26\+' 'From \$250|Desde \$250' '\$500' 'dit pack|aquete de' '\+3 |\+10 ' '5 business days|5 días hábiles' 'San Marcos, TX 78' ; do printf "%s=%s  " "$p" "$(echo "$t" | rg -c -e "$p" || echo 0)"; done; echo
echo "$t" | rg -o -e "\b(2|5|7|10|12|15|20) (small |cambios |ediciones )?[a-zé]*(edits|cambios|ediciones)[a-z ]{0,12}" | sort | uniq -c | head -12; done
