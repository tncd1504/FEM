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
     1 0.0 -1.00000e+000 0.0  
     2 0.0 -3.12500e-001 0.0  
     3 0.0         00000 0.0  
End Values 
# 
Result "Rotation" "Load Analysis"  1  Vector OnNodes 
ComponentNames "X-Rot", "Y-Rot", "Z-Rot" 
Values 
     1 -1.50000e-001 0.0 0.0  
     2 -1.12500e-001 0.0 0.0  
     3         00000 0.0 0.0  
End Values 
# 
Result "Reaction" "Load Analysis"  1  Vector OnNodes 
ComponentNames "X-Force", "Y-Force", "Z-Force" 
Values 
     1 0.0         00000 0.0  
     2 0.0         00000 0.0  
     3 0.0  5.00000e+000 0.0  
End Values 
# 
Result "Reaction Moment" "Load Analysis"  1  Vector OnNodes 
ComponentNames "X-Moment", "Y-Moment", "Z-Moment" 
Values 
     1 0.0 0.0         00000 
     2 0.0 0.0         00000 
     3 0.0 0.0  5.00000e+001 
End Values 
# 
Result "Moment" "Load Analysis"  1  Vector OnNodes 
ComponentNames "Mz", "My", "Mzy" 
Values 
     1 -5.28312e+000  0.0  0.0 
     2 -2.50000e+001  0.0  0.0 
     3 -4.47169e+001  0.0  0.0 
End Values 
