#!/bin/bash
BASE_URL="http://localhost:3001"
VERSION="v1"

GREEN="\033[1;32m"
YELLOW="\033[1;33m"
CYAN="\033[1;36m"
RESET="\033[0m"

declare -a DATASETS=(
  "classes-Clothing-Accessories"
  "classes-do-gia-dung"
  "classes-technology-gears"
  "classes-van-phong-pham"
)

reset_all() {
  echo -e "${YELLOW}Reset toàn bộ hệ thống (DB + uploads)...${RESET}"
  curl -s -X DELETE "$BASE_URL/tools/reset" | jq
  echo -e "${GREEN}Reset hoàn tất!${RESET}"
}

auto_label_all() {
  echo -e "${CYAN} Auto-label 4 datasets (version: $VERSION)${RESET}"
  echo "-----------------------------------------"

  for ds in "${DATASETS[@]}"; do
    echo -e "${YELLOW}Dataset: ${GREEN}$ds${RESET}"
    curl -s -X POST "$BASE_URL/pipeline/auto" \
      -H "Content-Type: application/json" \
      -d "{\"dataset\": \"$ds\", \"version\": \"$VERSION\"}" | jq
    echo "-----------------------------------------"
  done

  echo -e "${GREEN}Auto-label xong tất cả datasets!${RESET}"
}

# Giao diện menu
clear
echo -e "${CYAN}=== Labeling Pipeline CLI ===${RESET}"
echo "1.  Reset toàn hệ thống (xóa DB + uploads)"
echo "2.  Auto-label tất cả 4 datasets"
echo "0.  Thoát"
echo "---------------------------------"
read -p "Nhập lựa chọn (0-2): " choice
echo

case $choice in
  1)
    reset_all
    ;;
  2)
    read -p "Nhập version (mặc định v1): " version_input
    VERSION=${version_input:-v1}
    auto_label_all
    ;;
  0)
    echo -e "${GREEN}Thoát chương trình.${RESET}"
    exit 0
    ;;
  *)
    echo -e "${RED}Lựa chọn không hợp lệ!${RESET}"
    ;;
esac

echo
echo -e "${CYAN}=== Hoàn thành ===${RESET}"
