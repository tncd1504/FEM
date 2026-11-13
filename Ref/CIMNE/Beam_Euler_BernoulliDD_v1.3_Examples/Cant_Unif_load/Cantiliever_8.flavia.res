Gid Post Results File 1.0 
### 
# MAT-fem Euler Bernoulli Beam v1.3 
# 
GaussPoints "GPTR" Elemtype Linear 
Number of Gauss Points: 2 
Natural Coordinates: Internal 
end gausspionts 
# 
Result "Displacement" "Load Analysis"  1  Vector OnNodes 
ComponentNames "X-Displ", "Y-Displ", "Z-Displ" 
Values 
     1 0.0 -3.15000e+003 0.0  
     2 0.0 -2.62526e+003 0.0  
     3 0.0 -2.10410e+003 0.0  
     4 0.0 -1.59577e+003 0.0  
     5 0.0 -1.11563e+003 0.0  
     6 0.0 -6.85218e+002 0.0  
     7 0.0 -3.32227e+002 0.0  
     8 0.0 -9.04909e+001 0.0  
     9 0.0         00000 0.0  
End Values 
# 
Result "Rotation" "Load Analysis"  1  Vector OnNodes 
ComponentNames "X-Rot", "Y-Rot", "Z-Rot" 
Values 
     1 -1.05000e+003 0.0 0.0  
     2 -1.04795e+003 0.0 0.0  
     3 -1.03360e+003 0.0 0.0  
     4 -9.94630e+002 0.0 0.0  
     5 -9.18751e+002 0.0 0.0  
     6 -7.93654e+002 0.0 0.0  
     7 -6.07032e+002 0.0 0.0  
     8 -3.46583e+002 0.0 0.0  
     9         00000 0.0 0.0  
End Values 
# 
Result "Reaction" "Load Analysis"  1  Vector OnNodes 
ComponentNames "X-Force", "Y-Force", "Z-Force" 
Values 
     1 0.0         00000 0.0  
     2 0.0         00000 0.0  
     3 0.0         00000 0.0  
     4 0.0         00000 0.0  
     5 0.0         00000 0.0  
     6 0.0         00000 0.0  
     7 0.0         00000 0.0  
     8 0.0         00000 0.0  
     9 0.0         00004 0.0  
End Values 
# 
Result "Reaction Moment" "Load Analysis"  1  Vector OnNodes 
ComponentNames "X-Moment", "Y-Moment", "Z-Moment" 
Values 
     1 0.0 0.0         00000 
     2 0.0 0.0         00000 
     3 0.0 0.0         00000 
     4 0.0 0.0         00000 
     5 0.0 0.0         00000 
     6 0.0 0.0         00000 
     7 0.0 0.0         00000 
     8 0.0 0.0         00000 
     9 0.0 0.0  8.00000e+000 
End Values 
# 
Result "Moment" "Load Analysis"  1  Vector OnNodes 
ComponentNames "Mz", "My", "Mzy" 
Values 
     1 -5.58227e-003  0.0  0.0 
     2 -1.30582e-001  0.0  0.0 
     3 -5.05582e-001  0.0  0.0 
     4 -1.13058e+000  0.0  0.0 
     5 -2.00558e+000  0.0  0.0 
     6 -3.13058e+000  0.0  0.0 
     7 -4.50558e+000  0.0  0.0 
     8 -6.13058e+000  0.0  0.0 
     9 -7.58293e+000  0.0  0.0 
End Values 
