<script lang="ts" module>
  export const meta = {
    title: 'Skeleton',
    description: 'Loading placeholder with shimmer animation',
    category: 'Core UI',
  };
</script>

<script lang="ts">
  import Skeleton from './Skeleton.svelte';
</script>

<section>
  <h3>Variants</h3>
  <div style="display: flex; flex-direction: column; gap: 2rem;">
    <div>
      <p style="margin: 0 0 0.5rem 0; font-size: var(--font-size-sm); color: var(--tx-3);">Text (default)</p>
      <Skeleton variant="text" />
    </div>
    <div>
      <p style="margin: 0 0 0.5rem 0; font-size: var(--font-size-sm); color: var(--tx-3);">Circular</p>
      <Skeleton variant="circular" />
    </div>
    <div>
      <p style="margin: 0 0 0.5rem 0; font-size: var(--font-size-sm); color: var(--tx-3);">Rectangular</p>
      <Skeleton variant="rectangular" />
    </div>
  </div>
</section>

<section>
  <h3>Custom Dimensions</h3>
  <div style="display: flex; flex-direction: column; gap: 1rem;">
    <Skeleton width="200px" height="20px" />
    <Skeleton width="300px" height="16px" />
    <Skeleton variant="circular" width="64px" height="64px" />
    <Skeleton variant="rectangular" width="100%" height="200px" />
  </div>
</section>

<section>
  <h3>Multi-line Text</h3>
  <div style="max-width: 400px; display: flex; flex-direction: column; gap: 2rem;">
    <div>
      <p style="margin: 0 0 0.5rem 0; font-size: var(--font-size-sm); color: var(--tx-3);">2 lines</p>
      <Skeleton variant="text" lines={2} />
    </div>
    <div>
      <p style="margin: 0 0 0.5rem 0; font-size: var(--font-size-sm); color: var(--tx-3);">3 lines</p>
      <Skeleton variant="text" lines={3} />
    </div>
    <div>
      <p style="margin: 0 0 0.5rem 0; font-size: var(--font-size-sm); color: var(--tx-3);">5 lines</p>
      <Skeleton variant="text" lines={5} />
    </div>
  </div>
</section>

<section>
  <h3>Animation</h3>
  <div style="display: flex; gap: 2rem;">
    <div style="flex: 1;">
      <p style="margin: 0 0 0.5rem 0; font-size: var(--font-size-sm); color: var(--tx-3);">With shimmer (default)</p>
      <Skeleton width="100%" height="40px" animate={true} />
    </div>
    <div style="flex: 1;">
      <p style="margin: 0 0 0.5rem 0; font-size: var(--font-size-sm); color: var(--tx-3);">Without shimmer</p>
      <Skeleton width="100%" height="40px" animate={false} />
    </div>
  </div>
</section>

<section>
  <h3>Card Loading Example</h3>
  <div style="
    max-width: 350px;
    background: var(--bg-2);
    border: 1px solid var(--ui);
    border-radius: var(--radius-md);
    padding: 1rem;
  ">
    <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem;">
      <Skeleton variant="circular" width="48px" height="48px" />
      <div style="flex: 1;">
        <Skeleton width="60%" height="14px" />
        <div style="height: 0.5rem;"></div>
        <Skeleton width="40%" height="12px" />
      </div>
    </div>
    <Skeleton variant="rectangular" width="100%" height="120px" />
    <div style="margin-top: 1rem;">
      <Skeleton variant="text" lines={3} />
    </div>
  </div>
</section>

<section>
  <h3>Table Loading Example</h3>
  <div style="
    background: var(--bg-2);
    border: 1px solid var(--ui);
    border-radius: var(--radius-md);
    overflow: hidden;
  ">
    <div style="
      display: grid;
      grid-template-columns: 1fr 2fr 1fr 1fr;
      gap: 1rem;
      padding: 0.75rem 1rem;
      background: var(--bg-3);
      border-bottom: 1px solid var(--ui);
    ">
      <Skeleton width="60%" height="12px" />
      <Skeleton width="40%" height="12px" />
      <Skeleton width="50%" height="12px" />
      <Skeleton width="30%" height="12px" />
    </div>
    {#each [1, 2, 3, 4] as _}
      <div style="
        display: grid;
        grid-template-columns: 1fr 2fr 1fr 1fr;
        gap: 1rem;
        padding: 0.75rem 1rem;
        border-bottom: 1px solid var(--ui);
      ">
        <Skeleton width="80%" height="14px" />
        <Skeleton width="70%" height="14px" />
        <Skeleton width="60%" height="14px" />
        <Skeleton width="40%" height="14px" />
      </div>
    {/each}
  </div>
</section>

<section>
  <h3>Chat Message Loading</h3>
  <div style="display: flex; flex-direction: column; gap: 1rem; max-width: 500px;">
    <div style="display: flex; gap: 0.75rem;">
      <Skeleton variant="circular" width="32px" height="32px" />
      <div style="
        flex: 1;
        background: var(--bg-2);
        border-radius: var(--radius-md);
        padding: 0.75rem;
      ">
        <Skeleton variant="text" lines={2} />
      </div>
    </div>
    <div style="display: flex; gap: 0.75rem; justify-content: flex-end;">
      <div style="
        flex: 0 1 70%;
        background: var(--bg-3);
        border-radius: var(--radius-md);
        padding: 0.75rem;
      ">
        <Skeleton variant="text" lines={1} />
      </div>
      <Skeleton variant="circular" width="32px" height="32px" />
    </div>
  </div>
</section>

<section>
  <h3>Sidebar Loading</h3>
  <div style="
    width: 240px;
    background: var(--bg-2);
    border: 1px solid var(--ui);
    border-radius: var(--radius-md);
    padding: 1rem;
  ">
    <Skeleton width="40%" height="12px" />
    <div style="margin-top: 1rem; display: flex; flex-direction: column; gap: 0.75rem;">
      {#each [1, 2, 3, 4, 5] as _}
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <Skeleton variant="rectangular" width="20px" height="20px" />
          <Skeleton width="70%" height="14px" />
        </div>
      {/each}
    </div>
  </div>
</section>
