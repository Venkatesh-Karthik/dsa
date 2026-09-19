/**
 * Cognora Voice ORB Physics & Inertial Dynamics
 *
 * Tier 2 + Tier 3 Liquid Elastic Simulation:
 * - Spring-damper physics for scale, squish, stretch, and release overshoot
 * - Directional drag deformation (volume-preserving liquid elasticity)
 * - Inertial core lag (internal volume shifts opposite to acceleration)
 * - Smooth pointer parallax damping
 */

export interface SpringState {
  val: number;
  vel: number;
  target: number;
}

export class OrbPhysics {
  // Spring parameters: stiffness k, damping d
  private scaleSpring: SpringState = { val: 1.0, vel: 0, target: 1.0 };
  private squishXSpring: SpringState = { val: 1.0, vel: 0, target: 1.0 };
  private squishYSpring: SpringState = { val: 1.0, vel: 0, target: 1.0 };
  private coreOffsetX: SpringState = { val: 0, vel: 0, target: 0 };
  private coreOffsetY: SpringState = { val: 0, vel: 0, target: 0 };
  private coreOffsetZ: SpringState = { val: -0.18, vel: 0, target: -0.18 };
  private parallaxX: SpringState = { val: 0, vel: 0, target: 0 };
  private parallaxY: SpringState = { val: 0, vel: 0, target: 0 };

  // Drag tracking
  private prevDragX: number = 0;
  private prevDragY: number = 0;
  private dragVelX: number = 0;
  private dragVelY: number = 0;

  /**
   * Updates spring physics using a time-delta step (dt in seconds).
   * Tuned for high-viscosity liquid glass (critically damped, no rubber bounce).
   */
  private stepSpring(
    spring: SpringState,
    k: number = 190, // Spring stiffness
    d: number = 22, // High-viscosity damping factor
    dt: number = 0.016,
  ): void {
    const force = -k * (spring.val - spring.target) - d * spring.vel;
    spring.vel += force * dt;
    spring.val += spring.vel * dt;
  }

  /**
   * Feeds pointer/mouse coordinates for parallax response.
   * Pointer is normalized in [-1, 1] relative to the ORB center.
   */
  public setPointerTarget(normX: number, normY: number): void {
    // Clamp to reasonable parallax window
    this.parallaxX.target = Math.max(-1, Math.min(1, normX));
    this.parallaxY.target = Math.max(-1, Math.min(1, normY));
  }

  /**
   * Tracks drag motion to calculate instantaneous velocity, squish, and stretch.
   */
  public updateDrag(
    isDragging: boolean,
    currentX: number,
    currentY: number,
    dt: number = 0.016,
  ): void {
    if (!isDragging) {
      // Elastic return to neutral sphere
      this.squishXSpring.target = 1.0;
      this.squishYSpring.target = 1.0;
      this.coreOffsetX.target = 0;
      this.coreOffsetY.target = 0;
      this.dragVelX *= 0.85;
      this.dragVelY *= 0.85;
      this.prevDragX = currentX;
      this.prevDragY = currentY;
      return;
    }

    // Calculate drag velocity
    const dx = currentX - this.prevDragX;
    const dy = currentY - this.prevDragY;
    this.prevDragX = currentX;
    this.prevDragY = currentY;

    // Filter velocity
    this.dragVelX = this.dragVelX * 0.4 + dx * 0.6;
    this.dragVelY = this.dragVelY * 0.4 + dy * 0.6;

    const speed = Math.hypot(this.dragVelX, this.dragVelY);
    const maxStretch = 0.22;
    const stretchAmount = Math.min(maxStretch, speed * 0.015);

    // Directional volume-preserving stretch:
    // If moving horizontally, stretch X, compress Y.
    // If moving vertically, stretch Y, compress X.
    if (speed > 0.5) {
      const angle = Math.atan2(this.dragVelY, this.dragVelX);
      const cosA = Math.abs(Math.cos(angle));
      const sinA = Math.abs(Math.sin(angle));

      this.squishXSpring.target =
        1.0 + stretchAmount * cosA - stretchAmount * 0.5 * sinA;
      this.squishYSpring.target =
        1.0 + stretchAmount * sinA - stretchAmount * 0.5 * cosA;

      // Internal light lags behind motion (inertial liquid volume effect)
      this.coreOffsetX.target =
        -Math.cos(angle) * Math.min(0.35, stretchAmount * 1.5);
      this.coreOffsetY.target =
        -Math.sin(angle) * Math.min(0.35, stretchAmount * 1.5);
    } else {
      // Slight grab squish when held without moving
      this.squishXSpring.target = 1.03;
      this.squishYSpring.target = 0.97;
      this.coreOffsetX.target = 0;
      this.coreOffsetY.target = 0;
    }
  }

  /**
   * Sets target visual scale based on state and audio energy.
   */
  public setScaleTarget(targetScale: number): void {
    this.scaleSpring.target = targetScale;
  }

  /**
   * Advances simulation one frame and returns interpolated physical parameters.
   */
  public update(dt: number = 0.016) {
    this.stepSpring(this.scaleSpring, 220, 18, dt);
    this.stepSpring(this.squishXSpring, 160, 14, dt);
    this.stepSpring(this.squishYSpring, 160, 14, dt);
    this.stepSpring(this.coreOffsetX, 140, 16, dt);
    this.stepSpring(this.coreOffsetY, 140, 16, dt);
    this.stepSpring(this.coreOffsetZ, 120, 16, dt);
    this.stepSpring(this.parallaxX, 80, 12, dt);
    this.stepSpring(this.parallaxY, 80, 12, dt);

    // Virtual camera micro-parallax angle (±2.5 degrees ≈ ±0.045 rad)
    const cameraParallax: [number, number] = [
      this.parallaxX.val * 0.045,
      this.parallaxY.val * 0.045,
    ];

    return {
      scale: this.scaleSpring.val,
      squishX: this.squishXSpring.val,
      squishY: this.squishYSpring.val,
      coreOffset: [
        this.coreOffsetX.val,
        this.coreOffsetY.val,
        this.coreOffsetZ.val,
      ] as [number, number, number],
      parallax: [this.parallaxX.val, this.parallaxY.val] as [number, number],
      cameraParallax,
      velocity: [this.dragVelX, this.dragVelY] as [number, number],
    };
  }

  /**
   * Triggers an elastic tap ripple & pulse.
   */
  public triggerTapPulse(): void {
    this.scaleSpring.vel += 0.35;
    this.squishXSpring.vel -= 0.15;
    this.squishYSpring.vel += 0.15;
  }

  public reset(): void {
    this.scaleSpring = { val: 1.0, vel: 0, target: 1.0 };
    this.squishXSpring = { val: 1.0, vel: 0, target: 1.0 };
    this.squishYSpring = { val: 1.0, vel: 0, target: 1.0 };
    this.coreOffsetX = { val: 0, vel: 0, target: 0 };
    this.coreOffsetY = { val: 0, vel: 0, target: 0 };
    this.coreOffsetZ = { val: -0.18, vel: 0, target: -0.18 };
    this.parallaxX = { val: 0, vel: 0, target: 0 };
    this.parallaxY = { val: 0, vel: 0, target: 0 };
  }
}
