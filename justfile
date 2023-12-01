release:
	pnpm build
	echo '#!/usr/bin/env node' | cat - dist/client.js > dist/client-temp.js && mv dist/client-temp.js dist/client.js
	pnpm publish --no-git-checks

docker:
	docker build --no-cache -t pablof7z/nsecbunkerd .
	docker push pablof7z/nsecbunkerd
	ssh pablo@kind0 "docker pull pablof7z/nsecbunkerd"