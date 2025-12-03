<script setup lang="ts">
import { ClickLinkEvents, trackSocialLinks } from '~/analytics/analytics'

const { t } = useI18n()

// TODO - Make isMobile global
const width = ref(window.innerWidth)
const listener = () => {
  width.value = window.innerWidth
}
onMounted(() => {
  window.addEventListener('resize', listener)
})
onUnmounted(() => {
  window.removeEventListener('resize', listener)
})
</script>

<template>
  <section class="page">
    <div class="wrap-hero">
      <div class="wrap-title">
        <h1 class="title"><span class="text-primary">Decentralized</span> <br/>P2P Fiat Gateway</h1>
        <p class="sub-title">
          Trade <span class="text-primary">USDC</span> for Fiat Directly with Your Community in an Open Marketplace.
        </p>
        <div class="wrap-cta">
          <router-link to="/bridge" class="bridge-btn">
            🌉 Bridge to BSC
          </router-link>
          <div class="wrap-btns">

            <a href="https://github.com/desamtralized/localmoney" target="_blank" @click="trackSocialLinks(ClickLinkEvents.github)">
              <svg
                class="social-icon"
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M12 2C6.475 2 2 6.58819 2 12.2529C2 16.7899 4.8625 20.6219 8.8375 21.9804C9.3375 22.0701 9.525 21.7625 9.525 21.4934C9.525 21.2499 9.5125 20.4425 9.5125 19.5838C7 20.058 6.35 18.9558 6.15 18.3791C6.0375 18.0843 5.55 17.1743 5.125 16.9308C4.775 16.7386 4.275 16.2644 5.1125 16.2516C5.9 16.2388 6.4625 16.9949 6.65 17.3025C7.55 18.8533 8.9875 18.4175 9.5625 18.1484C9.65 17.4819 9.9125 17.0334 10.2 16.777C7.975 16.5207 5.65 15.6364 5.65 11.7147C5.65 10.5997 6.0375 9.67689 6.675 8.95918C6.575 8.70286 6.225 7.65193 6.775 6.24215C6.775 6.24215 7.6125 5.97301 9.525 7.29308C10.325 7.06239 11.175 6.94704 12.025 6.94704C12.875 6.94704 13.725 7.06239 14.525 7.29308C16.4375 5.9602 17.275 6.24215 17.275 6.24215C17.825 7.65193 17.475 8.70286 17.375 8.95918C18.0125 9.67689 18.4 10.5868 18.4 11.7147C18.4 15.6492 16.0625 16.5207 13.8375 16.777C14.2 17.0975 14.5125 17.7126 14.5125 18.6738C14.5125 20.0452 14.5 21.1474 14.5 21.4934C14.5 21.7625 14.6875 22.0829 15.1875 21.9804C17.1727 21.2933 18.8977 19.9852 20.1198 18.2402C21.3419 16.4952 21.9995 14.4012 22 12.2529C22 6.58819 17.525 2 12 2Z"
                  fill="inherit"
                />
              </svg>
            </a>
            <a
              href="https://t.me/LocalMoneyCommunity"
              target="_blank"
              @click="trackSocialLinks(ClickLinkEvents.litepaper)"
            >
              <svg
              class="social-icon"

                width="24px"
                height="24px"
                version="1.1"
                xmlns="http://www.w3.org/2000/svg"
                xmlns:xlink="http://www.w3.org/1999/xlink"
                xml:space="preserve"
                xmlns:serif="http://www.serif.com/"
                style="fill-rule: evenodd; clip-rule: evenodd; stroke-linejoin: round; stroke-miterlimit: 1.41421"
              >
                <path
                  id="telegram-1"
                  d="M18.384,22.779c0.322,0.228 0.737,0.285 1.107,0.145c0.37,-0.141 0.642,-0.457 0.724,-0.84c0.869,-4.084 2.977,-14.421 3.768,-18.136c0.06,-0.28 -0.04,-0.571 -0.26,-0.758c-0.22,-0.187 -0.525,-0.241 -0.797,-0.14c-4.193,1.552 -17.106,6.397 -22.384,8.35c-0.335,0.124 -0.553,0.446 -0.542,0.799c0.012,0.354 0.25,0.661 0.593,0.764c2.367,0.708 5.474,1.693 5.474,1.693c0,0 1.452,4.385 2.209,6.615c0.095,0.28 0.314,0.5 0.603,0.576c0.288,0.075 0.596,-0.004 0.811,-0.207c1.216,-1.148 3.096,-2.923 3.096,-2.923c0,0 3.572,2.619 5.598,4.062Zm-11.01,-8.677l1.679,5.538l0.373,-3.507c0,0 6.487,-5.851 10.185,-9.186c0.108,-0.098 0.123,-0.262 0.033,-0.377c-0.089,-0.115 -0.253,-0.142 -0.376,-0.064c-4.286,2.737 -11.894,7.596 -11.894,7.596Z"
                />
              </svg>
            </a>
          </div>
        </div>
      </div>
      <div class="wrap-img">
        <img src="../assets/header-img-2.png" alt="" />
      </div>
      <!-- <div v-if="!isMobile" class="wrap-img">
        <img src="../assets/header-img-2.png" alt="" />
      </div> -->
    </div>
  </section>
</template>

<style lang="scss" scoped>
@import '../style/tokens.scss';

section {
  display: flex;
  flex-direction: column;
  padding: 24px 24px 24px;
  margin-top: 100px;

  @media only screen and (max-width: $mobile) {
    margin-top: 0;
  }
}

.separator {
  width: 100%;
  margin: 0 auto 56px;
  height: 1px;
  background-color: $border;

  @media only screen and (max-width: $mobile) {
    margin: 0 auto 32px;
  }
}

.wrap-hero {
  display: flex;
  margin: 8px 0 40px;
}

.wrap-title {
  width: 55%;
  padding: 40px 0 40px 0;
}

.wrap-img {
  position: relative;
  width: 50%;

  img {
    position: absolute;
    width: 100%;
    padding: 0 0 0 80px;
  }
}

h1 {
  font-size: 38px;
  font-weight: 600;
  line-height: 120%;
  @media only screen and (max-width: 1155px) {
    font-size: 32px;
  }
}

.title {
  margin-bottom: 24px;
}
.sub-title {
  width: 80%;
  font-size: 20px;
  font-weight: 400;
  margin-bottom: 32px;
}
.text-primary {
  color: $primary;
  font-weight: 600;
}

.strong {
  font-weight: 600;
}
.wrap-cta {
  .bridge-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 16px 32px;
    background-color: $primary;
    color: $white;
    font-size: 16px;
    font-weight: $bold;
    border-radius: 8px;
    text-decoration: none;
    transition: all 0.3s ease;
    margin-bottom: 16px;

    &:hover {
      background-color: $secondary;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(239, 97, 0, 0.3);
    }
  }

  .wrap-btns {
    display: flex;
    align-items: center;
    gap: 24px;
    margin-top: 24px;
  }
  a {
  }
  p {
    font-size: 16px;
  }
  .social-icon {
    fill: $base-text;
    opacity: 0.5;
    transition: 300ms;
    padding-top: 2px;
    &:hover {
      opacity: 1;
      fill: $primary;
      transition: 300ms;
    }
  }
}

@media only screen and (max-width: $mobile) {
  section {
    display: flex;
    flex-direction: column-reverse;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    padding: 24px 0 24px;

    .wrap-hero {
      display: flex;
      flex-direction: column-reverse;
      margin: 8px 0 8px;
    }

    .wrap-img {
      position: relative;
      width: 100%;
      display: flex;

      img {
        position: relative;
        width: 100%;
        padding: 0 56px 8px;
      }
    }

    h1 {
      font-size: 38px;
    }

    .sub-title {
      font-size: 18px;
    }

    .wrap-title {
      width: 100%;
      text-align: center;
      padding: 16px 24px;
    }

    .sub-title {
      width: 100%;
    }

    .wrap-cta {
      .wrap-btns {
        display: flex;
        align-content: center;
        justify-content: center;
      }
    }
  }
}
</style>
