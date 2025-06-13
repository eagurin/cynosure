# Cynosure Bridge - Makefile для управления сервером
# Использование: make [команда]

.PHONY: help install dev build start stop test lint clean docker health status logs

# Переменные
NODE_ENV ?= development
PORT ?= 3000
LOG_LEVEL ?= info

# Цвета для вывода
RED=\033[0;31m
GREEN=\033[0;32m
YELLOW=\033[1;33m
BLUE=\033[0;34m
NC=\033[0m # No Color

# По умолчанию показываем help
help: ## Показать все доступные команды
	@echo "$(BLUE)Cynosure Bridge - OpenAI API Proxy для Claude$(NC)"
	@echo ""
	@echo "$(YELLOW)Доступные команды:$(NC)"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-15s$(NC) %s\n", $$1, $$2}'
	@echo ""
	@echo "$(YELLOW)Примеры:$(NC)"
	@echo "  make dev          # Запуск в режиме разработки"
	@echo "  make start        # Запуск продакшн сервера"
	@echo "  make test         # Запуск всех тестов"
	@echo "  make docker       # Сборка и запуск в Docker"

## Установка и настройка
install: ## Установить зависимости
	@echo "$(BLUE)📦 Установка зависимостей...$(NC)"
	npm install
	@echo "$(GREEN)✅ Зависимости установлены$(NC)"

setup: install ## Полная настройка проекта (установка + проверки)
	@echo "$(BLUE)🔧 Настройка проекта...$(NC)"
	@make typecheck
	@make lint
	@echo "$(GREEN)✅ Проект настроен и готов к работе$(NC)"

## Разработка
dev: ## Запуск сервера в режиме разработки с hot reload
	@echo "$(BLUE)🚀 Запуск dev сервера на порту $(PORT)...$(NC)"
	@echo "$(YELLOW)Откройте: http://localhost:$(PORT)$(NC)"
	PORT=$(PORT) npm run dev

dev-debug: ## Запуск в режиме разработки с отладкой
	@echo "$(BLUE)🐛 Запуск с отладкой...$(NC)"
	DEBUG=cynosure:* PORT=$(PORT) npm run dev

## Сборка и продакшн
build: ## Собрать проект для продакшн
	@echo "$(BLUE)🔨 Сборка проекта...$(NC)"
	npm run build
	@echo "$(GREEN)✅ Проект собран в ./dist$(NC)"

start: build ## Запуск продакшн сервера
	@echo "$(BLUE)🌟 Запуск продакшн сервера...$(NC)"
	NODE_ENV=production PORT=$(PORT) npm start

start-bg: build ## Запуск сервера в фоновом режиме
	@echo "$(BLUE)🌟 Запуск сервера в фоне...$(NC)"
	NODE_ENV=production PORT=$(PORT) nohup npm start > server.log 2>&1 & echo $$! > server.pid
	@echo "$(GREEN)✅ Сервер запущен в фоне (PID: $$(cat server.pid))$(NC)"

stop: ## Остановить фоновый сервер
	@if [ -f server.pid ]; then \
		echo "$(YELLOW)⏹️  Остановка сервера...$(NC)"; \
		kill $$(cat server.pid) && rm server.pid; \
		echo "$(GREEN)✅ Сервер остановлен$(NC)"; \
	else \
		echo "$(RED)❌ Файл PID не найден$(NC)"; \
	fi

restart: stop start-bg ## Перезапуск сервера

## Тестирование и качество кода
test: ## Запуск всех тестов
	@echo "$(BLUE)🧪 Запуск тестов...$(NC)"
	npm test

test-unit: ## Запуск только unit тестов
	@echo "$(BLUE)🔬 Запуск unit тестов...$(NC)"
	npm run test:unit

test-integration: ## Запуск только integration тестов
	@echo "$(BLUE)🔗 Запуск integration тестов...$(NC)"
	npm run test:integration

test-e2e: ## Запуск end-to-end тестов
	@echo "$(BLUE)🌐 Запуск e2e тестов...$(NC)"
	npm run test:e2e

test-coverage: ## Запуск тестов с покрытием
	@echo "$(BLUE)📊 Анализ покрытия тестами...$(NC)"
	npm run test:coverage

lint: ## Проверка кода с ESLint
	@echo "$(BLUE)🔍 Проверка кода...$(NC)"
	npm run lint

lint-fix: ## Автоматическое исправление проблем линтера
	@echo "$(BLUE)🔧 Исправление проблем кода...$(NC)"
	npm run lint:fix

format: ## Форматирование кода с Prettier
	@echo "$(BLUE)✨ Форматирование кода...$(NC)"
	npm run format

format-check: ## Проверка форматирования
	@echo "$(BLUE)🔍 Проверка форматирования...$(NC)"
	npm run format:check

typecheck: ## Проверка TypeScript типов
	@echo "$(BLUE)📝 Проверка типов...$(NC)"
	npm run typecheck

check-all: lint format-check typecheck test ## Полная проверка кода (lint + format + types + tests)
	@echo "$(GREEN)✅ Все проверки пройдены$(NC)"

## Docker операции
docker-build: ## Сборка Docker образа
	@echo "$(BLUE)🐳 Сборка Docker образа...$(NC)"
	docker build -t cynosure-bridge .
	@echo "$(GREEN)✅ Docker образ собран$(NC)"

docker-run: docker-build ## Запуск в Docker контейнере
	@echo "$(BLUE)🐳 Запуск в Docker...$(NC)"
	docker run -p $(PORT):3000 --name cynosure-bridge cynosure-bridge

docker-run-bg: docker-build ## Запуск Docker в фоновом режиме
	@echo "$(BLUE)🐳 Запуск Docker в фоне...$(NC)"
	docker run -d -p $(PORT):3000 --name cynosure-bridge cynosure-bridge
	@echo "$(GREEN)✅ Docker контейнер запущен$(NC)"

docker-stop: ## Остановка Docker контейнера
	@echo "$(YELLOW)⏹️  Остановка Docker...$(NC)"
	docker stop cynosure-bridge || true
	docker rm cynosure-bridge || true

docker-restart: docker-stop docker-run-bg ## Перезапуск Docker контейнера

docker-logs: ## Показать логи Docker контейнера
	docker logs cynosure-bridge

docker-shell: ## Подключиться к shell Docker контейнера
	docker exec -it cynosure-bridge sh

## Мониторинг и диагностика
health: ## Проверка здоровья сервера
	@echo "$(BLUE)🏥 Проверка здоровья сервера...$(NC)"
	@curl -s http://localhost:$(PORT)/health || echo "$(RED)❌ Сервер недоступен$(NC)"

health-detailed: ## Детальная проверка всех endpoints
	@echo "$(BLUE)🔍 Детальная проверка endpoints...$(NC)"
	@echo "Health endpoint:"
	@curl -s http://localhost:$(PORT)/health | jq . || echo "$(RED)❌ Health недоступен$(NC)"
	@echo "\nModels endpoint:"
	@curl -s http://localhost:$(PORT)/v1/models | jq . || echo "$(RED)❌ Models недоступен$(NC)"

status: ## Показать статус сервера
	@echo "$(BLUE)📊 Статус системы:$(NC)"
	@if [ -f server.pid ]; then \
		echo "$(GREEN)✅ Сервер запущен (PID: $$(cat server.pid))$(NC)"; \
	else \
		echo "$(YELLOW)⏸️  Сервер не запущен$(NC)"; \
	fi
	@echo "Порт: $(PORT)"
	@echo "NODE_ENV: $(NODE_ENV)"
	@echo "Версия Node.js: $$(node --version)"
	@echo "Версия npm: $$(npm --version)"

logs: ## Показать логи сервера
	@if [ -f server.log ]; then \
		echo "$(BLUE)📜 Последние логи:$(NC)"; \
		tail -f server.log; \
	else \
		echo "$(YELLOW)📜 Файл логов не найден$(NC)"; \
	fi

logs-tail: ## Отслеживание логов в реальном времени
	@if [ -f server.log ]; then \
		tail -f server.log; \
	else \
		echo "$(YELLOW)📜 Файл логов не найден. Запустите: make start-bg$(NC)"; \
	fi

## Тестирование API
test-api: ## Тестирование API endpoints
	@echo "$(BLUE)🧪 Тестирование API...$(NC)"
	@echo "Тест 1: Health endpoint"
	@curl -s http://localhost:$(PORT)/health
	@echo "\n\nТест 2: Models endpoint"
	@curl -s http://localhost:$(PORT)/v1/models
	@echo "\n\nТест 3: Chat completions (простой запрос)"
	@curl -X POST http://localhost:$(PORT)/v1/chat/completions \
		-H "Content-Type: application/json" \
		-H "Authorization: Bearer test-key" \
		-d '{"model": "gpt-4", "messages": [{"role": "user", "content": "Hello!"}], "max_tokens": 50}'

benchmark: ## Простой бенчмарк производительности
	@echo "$(BLUE)⚡ Бенчмарк производительности...$(NC)"
	@echo "Загрузочное тестирование (10 запросов):"
	@for i in $$(seq 1 10); do \
		echo -n "Запрос $$i: "; \
		time curl -s http://localhost:$(PORT)/health > /dev/null; \
	done

## Обслуживание
clean: ## Очистка временных файлов и кеша
	@echo "$(BLUE)🧹 Очистка проекта...$(NC)"
	rm -rf dist/
	rm -rf coverage/
	rm -rf node_modules/.cache/
	rm -f server.log server.pid
	npm cache clean --force
	@echo "$(GREEN)✅ Проект очищен$(NC)"

reset: clean install ## Полный сброс проекта
	@echo "$(GREEN)✅ Проект сброшен и переустановлен$(NC)"

update: ## Обновление зависимостей
	@echo "$(BLUE)📦 Обновление зависимостей...$(NC)"
	npm update
	npm audit fix
	@echo "$(GREEN)✅ Зависимости обновлены$(NC)"

## Утилиты
env: ## Показать переменные окружения
	@echo "$(BLUE)🌍 Переменные окружения:$(NC)"
	@echo "NODE_ENV: $${NODE_ENV:-not set}"
	@echo "PORT: $${PORT:-not set}"
	@echo "ANTHROPIC_API_KEY: $${ANTHROPIC_API_KEY:+***установлен***}"
	@echo "LOG_LEVEL: $${LOG_LEVEL:-not set}"

ports: ## Показать используемые порты
	@echo "$(BLUE)🔌 Сетевые порты:$(NC)"
	@lsof -i :$(PORT) || echo "Порт $(PORT) свободен"

deps: ## Показать зависимости проекта
	@echo "$(BLUE)📦 Зависимости проекта:$(NC)"
	@npm ls --depth=0

outdated: ## Проверить устаревшие зависимости
	@echo "$(BLUE)📊 Устаревшие зависимости:$(NC)"
	@npm outdated

## Git операции
commit: check-all ## Коммит с полной проверкой кода
	@echo "$(BLUE)📝 Подготовка к коммиту...$(NC)"
	git add .
	@echo "$(GREEN)✅ Все проверки пройдены. Готово к коммиту!$(NC)"

## Быстрые команды
quick-start: install dev ## Быстрый старт (установка + запуск)

full-check: clean install check-all ## Полная проверка с нуля

prod-deploy: clean install build test start ## Развертывание в продакшн

## Справка по переменным
vars: ## Показать доступные переменные
	@echo "$(BLUE)⚙️  Доступные переменные:$(NC)"
	@echo "  PORT=3000           # Порт сервера"
	@echo "  NODE_ENV=production # Режим работы"
	@echo "  LOG_LEVEL=info      # Уровень логирования"
	@echo ""
	@echo "$(YELLOW)Примеры использования:$(NC)"
	@echo "  make dev PORT=8080"
	@echo "  make start NODE_ENV=production"
	@echo "  make docker-run PORT=3001"